# node-sql

Easy SQL query building.

```
npm install @yo1dog/sql
```

## TOC

- [Quick Start](#quick-start)
- [Upgrading from V2](#upgrading-from-v2)
- [Template Tag](#template-tag)
- [`SQL(sqlOrText)`](#sqlsqlortext)
- [`SQL.build(string [, value [, ...]])`](#sqlbuildstring--value--)
- [`SQL.join(sqlOrVals, [separator])`](#sqljoinsqlorvals-separator)
- [`SQL.joinQueries(sqlOrTexts, [separator])`](#sqljoinqueriessqlortexts-separator)
- [`SQL.isSQL(val)`](#sqlissqlval)
- [`sqlQuery.append(sqlOrVal)`](#sqlqueryappendsqlorval)
- [`sqlQuery.appendQuery(sqlOrText)`](#sqlqueryappendquerysqlortext)
- [`sqlQuery.split(separator)`](#sqlquerysplitseparator)
- [`sqlQuery.isEmpty()`](#sqlqueryisempty)
- [`sqlQuery.isWhitespaceOnly()`](#sqlqueryiswhitespaceonly)
- [`sqlQuery.clone()`](#sqlqueryclone)

## Quick Start

```javascript
const {SQL} = require('@yo1dog/sql');
// OR
const {sql} = require('@yo1dog/sql');

const firstName = 'Bob';
const lastName = 'Smith';
const myId = 1234;
```

Use as a template tag:

```javascript
SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`
```

Expressions (`${}`) in `SQL` tagged templates are replaced with SQL variable substitutions. The
above returns a `SQLQuery` instance which has an object form of:

```javascript
{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```

`SQLQuery` instances can be passed directly to many SQL clients:

```javascript
pg.getPool().query(SQL`SELECT name FROM person WHERE id = ${myId}`);
```

Nested `SQLQuery`s are combined as expected:

```javascript
const sqlA = SQL`SELECT name`;
const sqlB = SQL`first_name = ${firstName}`;
const sqlC = SQL`last_name = ${lastName}`;
SQL`${sqlA} FROM person WHERE ${sqlB} AND ${sqlC}`;

// Equivalent to:
{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```

To prevent a string from being variable substituted, wrap the string with `SQL()`. This allows the
string to be added to the SQL text as-is. However, be sure you do not expose yourself to SQL
injection attacks!

```javascript
const tableName = 'person';
SQL`SELECT name FROM ${tableName     } WHERE id = ${myId}`
SQL`SELECT name FROM ${SQL(tableName)} WHERE id = ${myId}`

// Equivalent to:
{text: 'SELECT name FROM $1 WHERE id = $2', values: [tableName, myId]} // ERROR! Invalid SQL
{text: 'SELECT name FROM person WHERE id = $1', values: [myId]} // correct
```

Easily combine `SQLQuery`s and values in multiple ways:

```javascript
const conditionSQLs = [
  SQL`first_name = ${firstName}`,
  SQL`last_name = ${lastName}`,
  SQL`birthday IS NOT NULL`
];
const orderSQL = SQL`ORDER BY birthday ASC`;
const myIds = [31, 45, 22];
SQL`
  SELECT name
  FROM ${SQL(tableName)}
  WHERE
    ${SQL.join(conditionSQLs, ' AND ')}
    OR id IN (${SQL.join(myIds)})
  ${orderSQL}
`;

// Equivalent to:
{
  text: `
    SELECT name
    FROM person
    WHERE
      first_name = $1 AND last_name = $2 AND birthday IS NOT NULL
      OR id IN ($3, $4, $5)
    ORDER BY birthday ASC
  `,
  values: ['Bob', 'Smith', 31, 45, 22]
}
```

## Upgrading from V2

V3 Introduces several breaking changes to unify the way strings and `SQLQuery` arguments are
handled. Beware several breaking changes:

- The `SQL()` function handles arguments differently.
  - You can no longer use `SQL.build()` style arguments.
  - Passing no arguments will now result in an empty `SQLQuery`.
  - Passing a `SQLQuery` as the first argument will result in that `SQLQuery` being returned.
- `sqlQuery.append` will now use variable substitution if a string is given.
  - Use `sqlQuery.appendQuery` for the old behaviour.
- `sqlQuery.appendValue` is removed
  - Use `sqlQuery.append` instead.
- `sqlQuery.join` will now use variable substitution if a string is given.
  - Use `sqlQuery.joinQueries` for the old behaviour.
- `sqlQuery.joinValues` is removed.
  - Use `sqlQuery.join` instead.


## Template Tag

Use `SQL` as a template tag to create a `SQLQuery`. Expressions (`${}`) in `SQL` tagged templates
are replaced with SQL variable substitutions. Nesting of `SQLQuery` is supported.

Example:
```javascript
const sqlA = SQL`SELECT name`;
const sqlB = SQL`first_name = ${firstName}`;
const sqlC = SQL`last_name = ${lastName}`;
SQL`${sqlA} FROM person WHERE ${sqlB} AND ${sqlC}`;

// Equivalent to:
{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```


## `SQL(sqlOrText)`

```typescript
SQL(sqlOrText: SQLQuery | string): SQLQuery
```

Coerces the given value to a `SQLQuery`. If a `SQLQuery` is given it is returned as-is (it is not
cloned: see `sqlQuery.clone`). If a string is given a new `SQLQuery` is created using the string
as the query's text (without variable substitution).

Example:
```javascript
const tableName = 'person';
SQL`SELECT * FROM ${SQL(tableName)} WHERE id = ${id}`

// Equivalent to:
SQL`SELECT * FROM person WHERE id = ${id}`
```


## `SQL.build(string [, value [, ...]])`

```typescript
build(...strsAndVals: any[]): SQLQuery
```

An alternate way of building a query. Start with a string then alternate values and strings.

Example:
```javascript
SQL.build('SELECT name FROM person WHERE first_name = ', firstName, ' AND last_name = ', lastName);

// Equivalent to:
SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`;

// Equivalent to:
{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```


## `SQL.join(sqlOrVals, [separator])`

```typescript
join(sqlOrVals: any[], separator?: SQLQuery | string): SQLQuery
```

Joins multiple SQL queries and/or values into a single `SQLQuery`. If a `SQLQuery` is given it
is appened to the end of the `SQLQuery`. Otherwise, the value is appended to the end of the SQL
query (using variable substitution).

Separator can be a text string or a `SQLQuery` and defaults to `','`.

Similar to `Array.pototype.join`.

Example:
```javascript
SQL.join([
  SQL`first_name = ${firstName}`,
  SQL`last_name = ${lastName}`,
  hasBirthday
], ' AND ');

// Equivalent to:
SQL`first_name = ${firstName} AND last_name = ${lastName} AND ${hasBirthday}`
```


## `SQL.joinQueries(sqlOrTexts, [separator])`

```typescript
joinQueries(sqlOrTexts: (SQLQuery | string)[], separator?: SQLQuery | string): SQLQuery
```

Joins multiple SQL queries and/or text strings into a single `SQLQuery`. If a `SQLQuery` is
given it is appended to the end of the `SQLQuery`. If a string is given, it is appended to the
end of the `SQLQuery`'s text (without variable substitution).

Separator can be a text string or a `SQLQuery` and defaults to `','`.

Similar to `Array.pototype.join`.

Example:
```javascript
SQL.joinQueries([
  SQL`first_name = ${firstName}`,
  SQL`last_name = ${lastName}`,
  'birthday IS NOT NULL'
], ' AND ');

// Equivalent to:
SQL`first_name = ${firstName} AND last_name = ${lastName} AND birthday IS NOT NULL`
```


## `SQL.isSQL(val)`

```typescript
isSQL(val: any): val is SQLQuery
```

Returns if the given value is an instance of `SQLQuery`.

Example:
```javascript
SQL.isSQL(SQL`SELECT 1`); // true
SQL.isSQL('SELECT 1'); // false
```


## `sqlQuery.append(sqlOrVal)`

```typescript
append(sqlOrVal: any): this
```

If a `SQLQuery` is given, it is appended to the end of this `SQLQuery`. Otherwise, the value
is appended to the end of this `SQLQuery` using variable substitution.

Example:
```javascript
const sql = SQL`SELECT `;
sql.append(SQL`name FROM person WHERE id = `).append(id);

// Equivalent to:
SQL`SELECT name FROM person WHERE id = ${id}`
```


## `sqlQuery.appendQuery(sqlOrText)`

```typescript
appendQuery(sqlOrText: SQLQuery | string): this
```

If a `SQLQuery` is given, it is appended to the end of this `SQLQuery`. If a string is given,
it is appended to the end of this `SQLQuery`'s text (without variable substitution).

Example:
```javascript
const sql = SQL`SELECT `;
sql.appendQuery(SQL`name FROM person WHERE id = ${id}`).appendQuery(' AND name IS NOT NULL');

// Equivalent to:
SQL`SELECT name FROM person WHERE id = ${id} AND name IS NOT NULL`
```


## `sqlQuery.split(separator)`

```typescript
split(separator: string | RegExp): SQLQuery[]
```

Splits this `SQLQuery` into multiple `SQLQuery`s.

Example:
```javascript
const sql = SQL`WHERE first_name = ${firstName} AND last_name = ${lastName} AND birthday IS NOT NULL`;
sql.split('AND')

// Equivalent to:
[
  SQL`WHERE first_name = ${firstName} `,
  SQL` last_name = ${lastName} `,
  SQL` birthday IS NOT NULL`
]
```


## `sqlQuery.isEmpty()`

```typescript
isEmpty(): boolean
```

Returns if this `SQLQuery` is completely empty including whitespace and contains no variable
substitutions.

Example:
```javascript
SQL``      .isEmpty(); // true
SQL`    `  .isEmpty(); // false
SQL`SELECT`.isEmpty(); // false
SQL`${''}` .isEmpty(); // false
```


## `sqlQuery.isWhitespaceOnly()`

```typescript
isWhitespaceOnly(): boolean
```

Returns if this `SQLQuery` contains only whitespace and no variable substitutions.

Example:
```javascript
SQL``      .isWhitespaceOnly(); // true
SQL`    `  .isWhitespaceOnly(); // true
SQL`SELECT`.isWhitespaceOnly(); // false
SQL`${''}` .isWhitespaceOnly(); // false
```


## `sqlQuery.clone()`

```typescript
clone(): SQLQuery
```

Returns a copy of this `SQLQuery`. Note that this is a "shallow" clone in that the values
referenced by this query are not themselves cloned.

Example:
```javascript
const a = SQL`SELECT name FROM person WHERE first_name = ${firstName}`;
const b = a.clone();
b.append(SQL` AND last_name = ${lastName}`);

// Equivalent to:
const b = SQL`${a} AND last_name = ${lastName}`;
```
