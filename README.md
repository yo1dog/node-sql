# node-sql

Easy SQL query building.

```
npm install @yo1dog/sql
```

## Quick Start

```javascript
const {SQL} = require('@yo1dog/sql');
const firstName = 'Bob';
const lastName = 'Smith';
const myId = 1234;

// Use as a templated string tag:
SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`

// Expressions (${}) in SQL tagged template strings are replaced with SQL variable
// substitutions. The above returns a SQL query object which has the form:
{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}

// This SQL query can be passed directly to many SQL clients:
pg.getPool().query(SQL`SELECT name FROM person WHERE id = ${myId}`);
``` 

```javascript
// Nested SQL queries are combined as expected:
const sqlA = SQL`SELECT name`;
const sqlB = SQL`first_name = ${firstName}`;
const sqlC = SQL`last_name = ${lastName}`;
SQL`${sqlA} FROM person WHERE ${sqlB} AND ${sqlC}`;

{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```

```javascript
// To prevent a variable string from being replaced, wrap the string in a SQL
// query. Example: 
const tableName = 'person';
SQL`SELECT name FROM ${tableName     } WHERE id = ${myId}`
SQL`SELECT name FROM ${SQL(tableName)} WHERE id = ${myId}`

{
  text: 'SELECT name FROM $1 WHERE id = $2', // ERROR! Invalid SQL
  values: ['person', 1234]
}
{
  text: 'SELECT name FROM person WHERE id = $1', // OK
  values: [1234]
}
```

```javascript
// Easily combine SQL queries and values in multiple ways:
const conditionSQLs = [
  SQL`first_name = ${firstName}`,
  SQL`last_name = ${lastName}`,
  'birthday IS NOT NULL'
];
const orderSQL = SQL`ORDER BY birthday ASC`;
const myIds = [31, 45, 22];
SQL`
  SELECT name
  FROM ${SQL(tableName)}
  WHERE
    ${SQL.join(conditionSQLs, ' AND ')}
    OR id IN (${SQL.joinValues(myIds)})
  ${orderSQL}
`;

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

# Docs

## `SQL(string[, value[, string[, value[, ...]]]])`

Alias of `SQL.build`

-----

## `SQL.build(string[, value[, string[, value[, ...]]]])`

 param    | type   | description
----------|--------|-------------
`string`  | string | Part of the query.
`value`   | any    | A value that should be variable substituted in the query.

An alternate way of building a query. Start with a string then alternate
strings and values.

Returns a `SQLQuery` object.

Example:
```javascript
SQL('SELECT name FROM person WHERE first_name = ', firstName, ' AND last_name = ', lastName);
// Equivalent to:
SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`;

{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```

-----

## `SQL.join(sqls[, seperator])`

 param      | type                   | description
------------|------------------------|-------------
`sqls`      | (SQLQuery \| string)[] | SQL queries or strings to join.
`seperator` | SQLQuery \| string     | Seperator. Defaults to `','`

Joins multiple SQL queries and/or strings into a single SQL query with an optional
seperator. Similar to `Array.pototype.join`.

Returns a `SQLQuery` object.

Example:
```javascript
SQL.join([
  SQL`first_name = ${firstName}`,
  SQL`last_name = ${lastName}`,
  'birthday IS NULL'
], ' AND ')

{
  text: 'first_name = $1 AND last_name = $2 AND birthday IS NULL',
  values: ['Bob', 'Smith']
}
```

-----

## `SQL.joinValues(vals[, seperator])`

 param      | type               | description
------------|--------------------|-------------
`vals`      | any[]              | Values to join.
`seperator` | SQLQuery \| string | Seperator. Defaults to `','`

Joins values into a single SQL query with an optional seperator. Similar to
`Array.pototype.join`

Returns a `SQLQuery` object.

Example:
```javascript
SQL`
  INSERT (${SQL.joinValues(['a', 'b' 'c'], '), (')})
  INTO table
  WHERE id IN (${SQL.joinValues([31, 45, 22])})
`

{
  text: `
    INSERT ($1), ($2), ($3)
    INTO table
    WHERE id IN ($4, $5, $6)
  `,
  values: ['a', 'b', 'c', 31, 45, 22]
}
```

-----

## `SQL.isSQL(val)`

 param | type | description
-------|------|-------------
`val`  | any  | Value to test.

Returns if the given value is a SQL query object.

Example:
```javascript
SQL.isSQL(SQL`SELECT 1`); // true
SQL.isSQL('SELECT 1'); // false
`
```

-----

## `SQLQuery.prototype.append(sql)`

 param | type               | description
-------|--------------------|-------------
`sql`  | SQLQuery \| String | SQL to append.

Appends the given SQL query or string to the end of `this` SQL query.

Returns `this` SQL query object.

Example:
```javascript
const sql = SQL`SELECT `;
sql.append('name FROM person ').append(SQL`WHERE id = ${id}`);

sql
{
  text: 'SELECT name FROM person WHERE id = $1',
  values: [1234]
}
```

-----

## `SQLQuery.prototype.appendValue(val)`

 param | type | description
-------|------|-------------
`val`  | any  | Value to append.

Appends the given value to the end of `this` SQL query.

Returns `this` SQL query object.

Example:
```javascript
const sql = SQL`SELECT name FROM person WHERE id = `;
sql.appendValue(id);

sql
{
  text: 'SELECT name FROM person WHERE id = $1',
  values: [1234]
}
```

-----

## `SQLQuery.prototype.toPrettyString()`

Makes a half-hearted attempt to format `this` SQL query into a human-friendly
string.

-----

## `SQLQuery.prototype.split(seperator)`

 param      | type             | description
------------|------------------|-------------
`seperator` | RegExp \| string | Seperator

Splits `this` SQL query into multiple SQL queries.

Example:
```javascript
const sql = SQL`WHERE first_name = ${firstName} AND last_name = ${lastName} AND birthday IS NOT NULL`;
sql.split('AND')

[
  {
    text: 'WHERE first_name = $1 ',
    values: ['Bob']
  },
  {
    text: ' AND last_name = $1 ',
    values: ['Smith']
  },
  {
    text: ' AND birthday IS NOT NULL',
    values: []
  }
]
```

-----

## `SQLQuery.prototype.isEmpty()`

Returns if `this` SQL query is completly empty including whitespace
and contains no variables.

Example:
```javascript
SQL``      .isEmpty(); // true  - {text: '', values: []}
SQL`    `  .isEmpty(); // false - {text: '    ', values: []}
SQL`SELECT`.isEmpty(); // false - {text: 'SELECT', values: []}
SQL`${''}` .isEmpty(); // false - {text: '', values: ['']}
```

-----

## `SQLQuery.prototype.isWhitespaceOnly()`

Returns if `this` SQL query contains only whitespace and no variables.

Example:
```javascript
SQL``      .isEmpty(); // true  - {text: '', values: []}
SQL`    `  .isEmpty(); // true  - {text: '    ', values: []}
SQL`SELECT`.isEmpty(); // false - {text: 'SELECT', values: []}
SQL`${''}` .isEmpty(); // false - {text: '', values: ['']}
```
