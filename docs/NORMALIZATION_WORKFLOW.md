# Theme independent database normalization workflow

## The real goal of the first exam level

The input theme may be a shop, college, clinic, rental service, hotel, library,
repair workshop, or another domain. The task is not to remember a schema for a
particular theme. The task is to derive a correct schema from the documents and
source tables.

The expected workflow is:

```text
documents and raw spreadsheets
        ↓
entities relationships and business rules
        ↓
normalized sheets in LibreOffice Calc
        ↓
one CSV file per future database table
        ↓
DDL written in pgAdmin
        ↓
CSV import in dependency order
        ↓
database integrity checks
```

Do not start by writing SQL. First decide what each row means and which facts
belong together.

## Step 1 Read the documents before transforming data

Make four short lists on paper or on a `PLAN` sheet.

### Nouns

Nouns are candidate entities: client, employee, role, product, service, room,
course, student, order, appointment, rental, status, category.

A noun probably deserves a table when at least one condition is true:

- it has several attributes of its own;
- it occurs many times;
- other records refer to it;
- it changes independently;
- the task explicitly requires managing or filtering it.

### Events and documents

Verbs often reveal transactional tables: orders, books, enrolls, rents,
repairs, visits, pays. An event normally has a date, participants, status, and
one or more detail rows.

### Business rules

Write statements such as:

- one client can have many documents;
- one document contains many positions;
- one item can appear in many documents;
- an employee has one role;
- a course has many students and a student has many courses.

These sentences become one-to-many or many-to-many relationships.

### Required historical facts

Some values must be copied into a transaction even if the master record also
contains them. For example, the current item price belongs to the item, but the
price at the moment of sale belongs to the transaction line. Otherwise old
totals change when the current price changes.

## Step 2 Determine the grain of every source

The grain is what one row represents. State it as a complete sentence.

Examples:

- one row is one customer;
- one row is one item variant;
- one row is one order line;
- one row is one student-course enrollment;
- one row is one service performed during a visit.

If a row repeats the same document number, date, and client but changes the
item or service, the row is a detail line, not a whole document. The repeated
columns belong to a header table and the changing columns belong to a line
table.

Do not normalize until the grain is clear. Most incorrect schemas come from
confusing a document with a document line.

## Step 3 Find functional dependencies

Ask which key determines each value.

```text
customer_id → customer name phone email
item_id → item name category current price
document_id → date customer_id status_id
document_id + item_id → quantity price_at_event
```

This gives a practical normalization test:

- If several rows repeat the same customer attributes, extract a customer
  table.
- If a description depends on `category_id`, not on `item_id`, extract the
  category table.
- If quantity depends on both a document and an item, it belongs to the detail
  table.
- If a cell contains several values, it is not atomic and needs separate rows
  or a link table.

## Step 4 Normalize to third normal form

### First normal form

- One cell contains one value.
- No comma-separated lists inside a data field.
- No repeating groups such as `phone1`, `phone2`, `phone3` when the amount is
  unlimited.
- Every row can be identified by a key.

### Second normal form

For a table with a composite key, every non-key column must depend on the whole
key. In a `document_id + item_id` line table, item name depends only on
`item_id`, so item name belongs in the item table.

### Third normal form

Non-key columns must depend on the key, not on another non-key column. If an
employee row contains `role_name` and `role_description`, the description
depends on the role. Store it in a role table and keep `role_id` in employee.

Do not create a dictionary table for every repeated word. Extract a dictionary
when it represents an independent concept, has attributes, is referenced by
several rows, or is specifically managed by the system.

## Step 5 Recognize reusable table patterns

The names change between themes, but these patterns remain stable.

### Master and dictionary

```text
category 1 ─── many item
role     1 ─── many user
status   1 ─── many document
```

### Header and detail

```text
client 1 ─── many document 1 ─── many document_line many ─── 1 item
```

Examples include order/order line, visit/visit service, rental/rental item,
invoice/invoice line, or enrollment/enrollment subject.

### Many to many

```text
student 1 ─── many enrollment many ─── 1 course
```

The link table contains both foreign keys and attributes of the relationship,
such as enrollment date, grade, quantity, or assigned hours.

### Variant or stock table

When an item has sizes, colors, rooms, seats, batches, or other variants, keep
the master item separately and create a variant table. Its natural uniqueness
is usually the parent key plus the variant key.

## Step 6 Draw the schema before using Calc

For every future table write:

| Item | Questions |
| --- | --- |
| Table name | What single subject does the table describe? |
| Primary key | What identifies one row? |
| Columns | Does every column describe this subject? |
| Unique key | Which source value or combination must not repeat? |
| Foreign keys | Which parent tables does it reference? |
| Data types | Number, text, date, timestamp, boolean, decimal? |
| Nullability | Is the value genuinely optional? |

Then create a relationship list:

| Parent | Child | Cardinality | Foreign key |
| --- | --- | --- | --- |
| `parent_table` | `child_table` | one to many | `child.parent_id` |

This plan determines the workbook sheets and the SQL creation/import order.

## Step 7 Build a normalization workbook

Never change the only copy of the raw data. Use these sheet roles:

```text
PLAN
RAW_source_1
RAW_source_2
CLEAN_source_1
N_parent_1
N_parent_2
N_document
N_document_line
CHECKS
```

- `RAW_` sheets are untouched evidence.
- `CLEAN_` sheets contain helper columns for cleaned text and keys.
- `N_` sheets are the normalized tables that will become CSV files.
- `CHECKS` contains duplicate, orphan, count, and reconciliation tests.

Use database-style column names on `N_` sheets from the beginning. Keep one
header row and no titles, merged cells, totals, blank separator rows, colors as
data, or notes inside the export range.

## Step 8 Clean values without changing meaning

Typical cleanup:

- remove leading, trailing, duplicated, and non-breaking spaces;
- remove control characters and line breaks;
- standardize case only in a helper key, not necessarily in displayed text;
- standardize dates and decimal values;
- decide whether blank, zero, and `not applicable` are different;
- preserve leading zeros in codes by keeping them as text;
- create a manual mapping sheet for genuine synonyms or spelling variants.

Never join tables by an uncleaned displayed name. Create a canonical helper key
from the columns that truly identify the record.

## Step 9 Extract parent tables first

For each parent entity:

1. Copy only the columns that describe that entity.
2. Clean them.
3. Build a single-column canonical key or a composite helper key.
4. Extract unique records using a standard filter with `No duplication`, a
   pivot table, or `UNIQUE` if the installed Calc version supports it.
5. Sort the result in a stable order.
6. Assign integer IDs starting from 1.
7. Copy the ID column and paste values so later sorting cannot change IDs.

Deduplicate by the real key, not simply by the first visible name. Two people,
items, or services can share a name.

## Step 10 Replace repeated text with foreign keys

Return to each child sheet and build the same clean key used in its parent
table. Use exact `MATCH` plus `INDEX` to retrieve the parent ID.

Do not hide failed matches. A missing match must display a visible error such
as `NO MATCH` and be counted on the `CHECKS` sheet. Fix the source or mapping,
then recalculate.

After every lookup is valid, copy the foreign-key column and paste values.
Remove repeated parent attributes from the final child sheet. Keep only its own
attributes and foreign keys.

## Step 11 Build link and detail tables

For a many-to-many relationship or document detail, keep one row per
relationship:

```text
document_id | item_id | quantity | price_at_event
student_id  | course_id | enrollment_date | grade
visit_id    | service_id | employee_id | quantity | price_at_event
```

If the same key combination appears more than once, decide from the business
rules whether to aggregate the rows or whether another column is part of the
key. Do not silently delete duplicates.

## Step 12 Validate the normalized workbook

The `CHECKS` sheet should answer these questions before CSV export:

### Keys

- Is every primary key filled?
- Is every primary key unique?
- Is every required natural key unique?

### Relationships

- Does every foreign key exist in the parent table?
- Are there any `NO MATCH` cells?
- Does every link table contain valid key combinations?

### Counts

- Do the number of distinct raw entities and normalized parent rows match?
- Does the number of raw detail rows match the detail table unless an explained
  aggregation was required?

### Totals

- Do quantities, amounts, or hours reconcile between raw and normalized data?
- Does `quantity × price` reproduce source totals where applicable?

### Types

- Are dates real dates?
- Are decimals still numeric?
- Are IDs whole numbers?
- Are code fields with leading zeros still text?

Export only when all required checks pass.

## Step 13 Freeze and export one CSV per table

For each `N_` sheet:

1. Copy the final range.
2. Paste Special as values into a clean export sheet or a separate workbook.
3. Confirm that no formulas or helper columns remain.
4. Put database column names in row 1.
5. Save only that sheet as CSV.
6. Use UTF-8, a known delimiter, a double quote text delimiter, and headers.
7. Open the CSV in a text editor and inspect the first, middle, and last rows.

Semicolon is often convenient with Russian spreadsheet locales because decimal
values may use a comma. The chosen delimiter and decimal representation must
match the pgAdmin import settings and PostgreSQL column types.

## Step 14 Write SQL yourself from the model

Create tables in dependency order:

1. independent dictionaries;
2. master entities;
3. document headers or events;
4. variants, links, and detail tables.

For every table write the primary key, required `UNIQUE` constraints, data-type
checks, and foreign keys. The normalized sheets should already have the same
column order and compatible types.

Import parent CSV files before child CSV files. After import, repeat the key,
orphan, count, and total checks with SQL. Spreadsheet checks prove the workbook;
SQL checks prove that the database contains the same correct result.

## Three practical approaches

### Plan A Formulas and standard filters

Recommended for the exam. It is visible, easy to debug, does not depend on
macros being enabled, and adapts to a different theme. Use helper columns,
standard filters with no duplication, stable IDs, and exact lookups.

### Plan B Mostly manual for a small dataset

Copy entity columns to separate sheets, clean them, use the standard filter to
remove duplicates, assign IDs, and use lookups for foreign keys. This can be
faster for a few dozen rows but still requires all validation checks.

### Plan C Configurable Calc macro

A macro can automate cleanup, distinct extraction, ID assignment, and CSV
export. It is useful only if macros are allowed, the security settings permit
them, and the macro is driven by column headers or a mapping sheet. A macro
hard-coded for products, orders, or shoe sizes will fail when the theme changes.

SQL-only staging is another technical option, but it should not replace the
spreadsheet normalization workflow when that workflow is the assessed skill.

## What to practice

Repeat the workflow on several domains:

| Domain | Expected central pattern |
| --- | --- |
| Shop | customer, item, order, order line |
| College | student, group, course, enrollment |
| Clinic | patient, employee, visit, visit service |
| Rental | client, asset, rental, rental item |
| Hotel | guest, room, booking, booking service |

For each practice run, begin with a new workbook and blank SQL file. The goal
is to recognize the pattern, not remember table names from the previous theme.
