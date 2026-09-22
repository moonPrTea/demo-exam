# LibreOffice Calc formulas for normalization

The examples use English function names and `;` as the argument separator. In
LibreOffice you can enable English names under `Tools > Options > LibreOffice
Calc > Formula`. If the exam installation uses localized names or another
separator, adapt the syntax once before starting.

Assume row 1 contains headers and data begins on row 2.

## Clean text

Remove non-breaking spaces, control characters, repeated spaces, and spaces at
the beginning or end:

```text
=TRIM(CLEAN(SUBSTITUTE(A2;CHAR(160);" ")))
```

Create a case-insensitive helper key without changing the displayed value:

```text
=LOWER(TRIM(CLEAN(SUBSTITUTE(A2;CHAR(160);" "))))
```

Build a composite key when one column is not unique:

```text
=LOWER(B2&"|"&C2)
```

Use already cleaned columns in the composite key. Choose columns from the real
business key, not every descriptive column.

## Detect blanks and suspicious values

```text
=IF(A2="";"MISSING";"")
```

Count missing values in a required column:

```text
=COUNTBLANK(A2:A1000)
```

Do not replace a missing value with zero unless zero has the same business
meaning.

## Detect duplicate keys

Show how many times a key occurs:

```text
=COUNTIF($E$2:$E$1000;E2)
```

Display only the problem:

```text
=IF(COUNTIF($E$2:$E$1000;E2)>1;"DUPLICATE";"")
```

For a composite key, first create the helper key and run `COUNTIF` on it.

## Extract distinct records

The most compatible method is:

1. Select the cleaned entity columns, including the helper key.
2. Open `Data > More Filters > Standard Filter`.
3. Open Options.
4. Enable `No duplication`.
5. Enable `Copy results to` and choose the new normalized sheet.

If the installed Calc version supports `UNIQUE`, it can be used for practice,
but do not depend on it without checking the exam computer.

## Assign stable IDs

After unique records are sorted, enter `1` and `2` in the first two ID cells,
select both, and drag down. This is safer across Calc versions than depending
on a newer formula.

If you use a row formula while preparing:

```text
=ROW()-1
```

copy the entire ID column and use Paste Special as values before further
sorting. Foreign keys must not change because the sheet moved.

## Look up a foreign key

Assume the parent table has IDs in column A and clean keys in column E:

```text
=IFERROR(
    INDEX(Parent.$A$2:$A$1000;MATCH(E2;Parent.$E$2:$E$1000;0));
    "NO MATCH"
)
```

`MATCH(...;0)` is essential because it requests an exact match. Do not use an
approximate match on unsorted identifiers.

Count failed relationships:

```text
=COUNTIF(F2:F1000;"NO MATCH")
```

After the count is zero, paste the foreign-key column as values.

## Check that a foreign key exists

If the child already contains an ID:

```text
=IF(COUNTIF(Parent.$A$2:$A$1000;B2)=1;"";"INVALID FK")
```

The expected count is exactly one.

## Normalize booleans

Example for Russian source values:

```text
=IF(OR(LOWER(TRIM(A2))="да";A2="1");TRUE();FALSE())
```

First inspect every distinct source value. Do not assume that anything other
than `Да` means false when blanks or unknown statuses exist.

## Dates

Keep source dates as real date values. Apply the display format `YYYY-MM-DD`
before export. If a text date must be parsed, test the actual source format
rather than guessing it.

A final CSV text helper can be used when necessary:

```text
=TEXT(A2;"YYYY-MM-DD")
```

This returns text, so use it only in the export copy, not as the main working
date column.

## Numbers and decimals

Convert a numeric text value that uses a comma decimal separator:

```text
=VALUE(SUBSTITUTE(A2;",";"."))
```

Depending on the Calc locale, `VALUE` may expect a comma instead. Test with a
known half-decimal and inspect the exported CSV. Keep quantity as a whole
number only when the domain guarantees it; sizes, weights, prices, and hours
may require decimals.

Round only when the business rule requires it:

```text
=ROUND(A2;2)
```

## Reconcile counts

Count non-empty raw rows:

```text
=COUNTA(RAW.$A$2:$A$1000)
```

Count normalized rows:

```text
=COUNTA(N_entity.$A$2:$A$1000)
```

The counts do not always have to be equal. Record why rows were deduplicated,
aggregated, or rejected.

## Reconcile totals

```text
=SUM(RAW.$H$2:$H$1000)
=SUM(N_detail.$D$2:$D$1000)
```

For line amounts:

```text
=SUMPRODUCT(N_detail.$D$2:$D$1000;N_detail.$E$2:$E$1000)
```

Compare the raw and normalized values on the `CHECKS` sheet. A zero difference
is evidence that the transformation did not lose or duplicate data.

## Split non-atomic values

If one cell contains several values, use `Data > Text to Columns` only as the
first step. A normalized link table still needs one value per row. Reshape the
split columns into repeated rows and attach the parent ID to every row.

Do not leave comma-separated IDs or names in a database field.

## Generate SQL only as a fallback

Calc can generate `INSERT` statements, but CSV import is usually faster and
safer. If statements are required, escape single quotes:

```text
="INSERT INTO entity(name) VALUES ('"&SUBSTITUTE(A2;"'";"''")&"');"
```

This does not replace normalization, keys, foreign-key checks, or data-type
validation.
