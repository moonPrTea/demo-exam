# Шпаргалка C# WinForms и Npgsql

## Подключение без зависимости от новой версии Npgsql

```csharp
private const string ConnectionString =
    "Host=localhost;Port=5432;Database=miracle_shoes;Username=postgres;Password=CHANGE_ME";

public static DataTable Query(string sql, params NpgsqlParameter[] parameters)
{
    var table = new DataTable();

    using (var connection = new NpgsqlConnection(ConnectionString))
    using (var command = new NpgsqlCommand(sql, connection))
    using (var adapter = new NpgsqlDataAdapter(command))
    {
        command.Parameters.AddRange(parameters);
        connection.Open();
        adapter.Fill(table);
    }

    return table;
}
```

Этот стиль работает со старыми версиями Npgsql лучше, чем примеры с
`NpgsqlDataSource`.

## Авторизация по логину

```csharp
const string sql = @"
    SELECT user_id, login, last_name, first_name, middle_name, role
    FROM exam.app_users
    WHERE login = @login";

using (var connection = new NpgsqlConnection(ConnectionString))
using (var command = new NpgsqlCommand(sql, connection))
{
    command.Parameters.AddWithValue("login", loginTextBox.Text.Trim());
    connection.Open();

    using (var reader = command.ExecuteReader())
    {
        if (!reader.Read())
        {
            MessageBox.Show("Пользователь с таким логином не найден.");
            return;
        }

        Session.UserId = reader.GetInt32(reader.GetOrdinal("user_id"));
        Session.Role = reader.GetString(reader.GetOrdinal("role"));
    }
}
```

Роли лучше сравнивать с константами, чтобы не получить опечатку в нескольких
формах.

```csharp
public static class Roles
{
    public const string Admin = "Администратор";
    public const string Manager = "Менеджер";
    public const string Customer = "Авторизованный пользователь";
}
```

## Запрос каталога

```sql
SELECT
    p.product_id,
    p.category,
    p.subcategory,
    p.name,
    p.manufacturer,
    p.description,
    p.composition,
    p.image_file,
    p.price,
    COALESCE(SUM(si.available_quantity), 0) AS total_stock,
    COALESCE(
        string_agg(
            trim(to_char(si.shoe_size, 'FM9990D0')),
            ', ' ORDER BY si.shoe_size
        ) FILTER (WHERE si.available_quantity > 0),
        ''
    ) AS available_sizes
FROM exam.products p
LEFT JOIN exam.stock_items si ON si.product_id = p.product_id
WHERE (@category = '' OR p.category = @category)
  AND (
      @search = ''
      OR p.name ILIKE '%' || @search || '%'
      OR p.manufacturer ILIKE '%' || @search || '%'
      OR p.description ILIKE '%' || @search || '%'
  )
GROUP BY p.product_id
ORDER BY p.name;
```

Для сортировки заменить только последнюю часть запроса одним из разрешенных
фрагментов:

```csharp
string orderBy;
switch (sortComboBox.SelectedIndex)
{
    case 1: orderBy = "p.price ASC"; break;
    case 2: orderBy = "p.price DESC"; break;
    case 3: orderBy = "total_stock ASC"; break;
    default: orderBy = "p.name ASC"; break;
}
```

Нельзя вставлять в SQL произвольный текст из `ComboBox`.

## Подсветка малого остатка

```csharp
private static readonly Color LowStockColor = Color.FromArgb(255, 128, 128);

private void catalogGrid_RowPrePaint(object sender, DataGridViewRowPrePaintEventArgs e)
{
    var row = catalogGrid.Rows[e.RowIndex];
    if (row.Cells["total_stock"].Value == DBNull.Value)
        return;

    int totalStock = Convert.ToInt32(row.Cells["total_stock"].Value);
    row.DefaultCellStyle.BackColor = totalStock <= 3
        ? LowStockColor
        : Color.White;
}
```

## Безопасная загрузка изображения

```csharp
private void ShowProductImage(string fileName)
{
    string images = Path.Combine(Application.StartupPath, "Assets", "Images");
    string path = Path.Combine(images, fileName ?? string.Empty);
    string fallback = Path.Combine(Application.StartupPath, "Assets", "picture.png");

    productPicture.Image?.Dispose();
    productPicture.SizeMode = PictureBoxSizeMode.Zoom;

    string selectedPath = File.Exists(path) ? path : fallback;
    using (var source = Image.FromFile(selectedPath))
    {
        productPicture.Image = new Bitmap(source);
    }
}
```

Клонирование изображения через `new Bitmap` освобождает блокировку исходного
файла после закрытия `using`.

## Добавление строки в корзину

```csharp
var existing = cart.FirstOrDefault(x =>
    x.ProductId == productId && x.Size == selectedSize);

if (existing == null)
{
    cart.Add(new CartLine
    {
        ProductId = productId,
        ProductName = productName,
        Size = selectedSize,
        Quantity = 1,
        UnitPrice = unitPrice,
        AvailableQuantity = availableQuantity
    });
}
else if (existing.Quantity < existing.AvailableQuantity)
{
    existing.Quantity++;
}
else
{
    MessageBox.Show("Нельзя добавить больше доступного остатка.");
}
```

Итог в C# считается типом `decimal`:

```csharp
decimal total = cart.Sum(x => x.UnitPrice * x.Quantity);
totalLabel.Text = total.ToString("N2") + " ₽";
```

## Транзакция создания заказа

```csharp
using (var connection = new NpgsqlConnection(ConnectionString))
{
    connection.Open();

    using (var transaction = connection.BeginTransaction())
    {
        try
        {
            int orderId;
            const string insertOrder = @"
                INSERT INTO exam.orders(order_date, customer_id, created_by_id)
                VALUES (CURRENT_DATE, @customer_id, @created_by_id)
                RETURNING order_id";

            using (var command = new NpgsqlCommand(insertOrder, connection, transaction))
            {
                command.Parameters.AddWithValue("customer_id", customerId);
                command.Parameters.AddWithValue("created_by_id", Session.UserId);
                orderId = Convert.ToInt32(command.ExecuteScalar());
            }

            foreach (var line in cart)
            {
                const string takeStock = @"
                    UPDATE exam.stock_items
                    SET available_quantity = available_quantity - @quantity
                    WHERE product_id = @product_id
                      AND shoe_size = @size
                      AND available_quantity >= @quantity";

                using (var command = new NpgsqlCommand(takeStock, connection, transaction))
                {
                    command.Parameters.AddWithValue("quantity", line.Quantity);
                    command.Parameters.AddWithValue("product_id", line.ProductId);
                    command.Parameters.AddWithValue("size", line.Size);

                    if (command.ExecuteNonQuery() != 1)
                        throw new InvalidOperationException("Недостаточно товара на складе.");
                }

                const string insertLine = @"
                    INSERT INTO exam.order_items
                        (order_id, product_id, shoe_size, quantity, unit_price)
                    SELECT @order_id, p.product_id, @size, @quantity, p.price
                    FROM exam.products p
                    WHERE p.product_id = @product_id";

                using (var command = new NpgsqlCommand(insertLine, connection, transaction))
                {
                    command.Parameters.AddWithValue("order_id", orderId);
                    command.Parameters.AddWithValue("product_id", line.ProductId);
                    command.Parameters.AddWithValue("size", line.Size);
                    command.Parameters.AddWithValue("quantity", line.Quantity);
                    command.ExecuteNonQuery();
                }
            }

            transaction.Commit();
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            MessageBox.Show(ex.Message, "Заказ не сохранен");
        }
    }
}
```

## Запрос списка заказов

```sql
SELECT
    o.order_id,
    o.order_date,
    concat_ws(' ', u.last_name, u.first_name, u.middle_name) AS customer_name,
    SUM(oi.quantity * oi.unit_price) AS order_total
FROM exam.orders o
JOIN exam.app_users u ON u.user_id = o.customer_id
JOIN exam.order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id, u.user_id
ORDER BY o.order_date DESC, o.order_id DESC;
```

## Удаление заказа с возвратом остатка

Обе команды выполнять в одной транзакции. Сначала вернуть товар, затем удалить
заказ. Благодаря `ON DELETE CASCADE` строки заказа удалятся автоматически.

```sql
UPDATE exam.stock_items si
SET available_quantity = si.available_quantity + source.quantity
FROM (
    SELECT product_id, shoe_size, SUM(quantity)::integer AS quantity
    FROM exam.order_items
    WHERE order_id = @order_id
    GROUP BY product_id, shoe_size
) source
WHERE si.product_id = source.product_id
  AND si.shoe_size = source.shoe_size;

DELETE FROM exam.orders
WHERE order_id = @order_id;
```

Для изменения количества администратором вычислить
`delta = newQuantity - oldQuantity`. Положительную разницу списать условным
`UPDATE ... AND available_quantity >= @delta`; отрицательную вернуть на склад.
Только после успешного изменения остатка обновлять строку заказа, и все действия
выполнять в одной транзакции.

## Быстрая настройка стиля

```csharp
public static class UiTheme
{
    public static readonly Color Main = Color.White;
    public static readonly Color Secondary = ColorTranslator.FromHtml("#D2F6E7");
    public static readonly Color Accent = ColorTranslator.FromHtml("#70B2AF");
    public static readonly Font DefaultFont = new Font("Calibri", 11F);

    public static void Apply(Form form)
    {
        form.BackColor = Main;
        form.Font = DefaultFont;
    }
}
```

Для каждой основной кнопки установить `BackColor = UiTheme.Accent` и
`UseVisualStyleBackColor = false`. Для панелей второго уровня использовать
`UiTheme.Secondary`.

## Частые ошибки

- `AddWithValue` получил `double` для размера вместо `decimal`.
- Один `NpgsqlDataReader` еще открыт, а на том же соединении запускается новая
  команда.
- Поиск перезагружает данные, но забывает действующий фильтр или сортировку.
- Цвет определяется по остатку выбранного размера вместо суммы по модели.
- Цена заказа берется из подписи на форме, а не из базы.
- Сначала создается заказ, затем отдельными соединениями его строки. При ошибке
  остается пустой заказ.
- Изображение загружается без `File.Exists` и без запасной картинки.
- Менеджеру случайно доступно редактирование, потому что проверена только
  видимость кнопки.
