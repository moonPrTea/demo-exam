# PostgreSQL database setup

Run the scripts in this order from pgAdmin Query Tool:

1. `01_schema.sql`
2. `02_prepare_staging.sql`
3. Import the five CSV files into the matching `exam.stage_*` tables.
4. `03_apply_import.sql`
5. `04_checks.sql`

Save the original `.xlsx` sheets as CSV in LibreOffice Calc. Use UTF-8,
semicolon as the field delimiter, `"` as the text delimiter and keep the first
header row. In pgAdmin enable Header and select UTF8 and `;` for each import.

The destination staging columns are positional:

| Source file | Destination table |
| --- | --- |
| `Users_import.xlsx` | `exam.stage_users` |
| `Products_import.xlsx` | `exam.stage_products` |
| `Sizes_import.xlsx` | `exam.stage_sizes` |
| `Stock_Items_import.xlsx` | `exam.stage_stock_items` |
| `Orders_import.xlsx` | `exam.stage_orders` |

The staging columns are text on purpose. The apply script handles decimal
commas, two common date formats, non-breaking spaces and the known product-name
alias before it creates foreign-key relationships.
