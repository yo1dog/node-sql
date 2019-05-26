class SQLQuery {
  /**
   * Creates a SQL query object. Used internally by SQL.
   * 
   * @param {string[]} origStrings 
   * @param {any[]} origValues 
   */
  constructor(origStrings, origValues) {
    if (!Array.isArray(origStrings)) {
      if (typeof origStrings === 'undefined') {
        origStrings = [''];
      }
      origStrings = [origStrings];
    }
    if (!origValues) {
      origValues = [];
    }
    
    this.strings = [];
    this.values = [];
    
    // add the first string
    this.strings.push(origStrings[0]);
    
    // for each value...
    for (let i = 0; i < origValues.length; ++i) {
      const value = origValues[i];
      const followingStr = origStrings[i + 1];
      
      // check if the value is a query
      if (!(value instanceof SQLQuery)) {
        // if not, just add the value and the following string
        this.values.push(value);
        this.strings.push(followingStr);
        continue;
      }
      
      const sqlQuery = value;
      
      // add the query's strings and values
      this.append(sqlQuery);
      
      // append the following string to the last string
      this.strings[this.strings.length - 1] += followingStr;
    }
  }
  
  /**
   * Appends the given SQL query or string to the end of this SQL query.
   * 
   * Example:
```
const sql = SQL`SELECT `;
sql.append('name FROM person ').append(SQL`WHERE id = ${id}`);

sql
{
  text: 'SELECT name FROM person WHERE id = $1',
  values: [1234]
}
```
   * 
   * @param {SQLQuery | string} sql 
   * @returns {SQLQuery}
   */
  append(sql) {
    if (!(sql instanceof SQLQuery)) {
      this.strings[this.strings.length - 1] += sql;
      return this;
    }
    
    const sqlQuery = sql;
    
    // append the query's first string to the last string
    this.strings[this.strings.length - 1] += sqlQuery.strings[0];
    
    // add the rest of the query's strings and values
    for (let j = 0; j < sqlQuery.values.length; ++j) {
      this.values.push(sqlQuery.values[j]);
      this.strings.push(sqlQuery.strings[j + 1]);
    }
    
    return this;
  }
  
  /**
   * Appends the given value to the end of this SQL query.
   * 
   * Example:
```
const sql = SQL`SELECT name FROM person WHERE id = `;
sql.appendValue(id);

sql
{
  text: 'SELECT name FROM person WHERE id = $1',
  values: [1234]
}
```
   * 
   * @param {any} val 
   * @returns {SQLQuery}
   */
  appendValue(val) {
    this.values.push(val);
    this.strings.push('');
    
    return this;
  }
  
  /**
   * Makes a half-hearted attempt to format this SQL query into
   * a human-friendly string.
   * 
   * @returns {string}
   */
  toPrettyString() {
    const str = this.text;
    
    // remove extra space padding
    const lines = str.replace(/\r\n/g, '\n').split('\n');
    
    let minPaddingLen = 9999;
    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      for (let j = 0; j < line.length && j < minPaddingLen; ++j) {
        if (line.charCodeAt(j) !== 32) {
          minPaddingLen = j;
          break;
        }
      }
    }
    
    // skip empty starting lines
    let nonEmptyIndex;
    for (nonEmptyIndex = 0; nonEmptyIndex < lines.length; ++nonEmptyIndex) {
      if (lines[nonEmptyIndex].trim().length > 0) {
        break;
      }
    }
    
    // skip empty trailing lines
    let nonEmptyLength;
    for (nonEmptyLength = lines.length; nonEmptyLength > 0; --nonEmptyLength) {
      if (lines[nonEmptyLength - 1].trim().length > 0) {
        break;
      }
    }
    
    let prettyStr = '';
    for (let i = nonEmptyIndex; i < nonEmptyLength; ++i) {
      if (i > nonEmptyIndex) {
        prettyStr += '\n';
      }
      prettyStr += lines[i].substring(minPaddingLen);
    }
    
    return prettyStr;
  }
  
  /**
   * Splits this SQL query into multiple SQL queries.
   * 
   * Example:
```
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
   * 
   * @param {string | RegExp} seperator 
   * @returns {SQLQuery[]}
   */
  split(seperator) {
    let regex;
    if (seperator instanceof RegExp) {
      regex = seperator;
    }
    else {
      regex = new RegExp(escapeRegExp(seperator), 'g');
    }
    
    let curSQLQuery = new SQLQuery();
    const spltSQLQueries = [curSQLQuery];
    
    for (let i = 0; i < this.strings.length; ++i) {
      const str = this.strings[i];
      
      // for each occurrence of the token in the string...
      let startIndex = 0;
      let match;
      while ((match = regex.exec(str))) {
        const substr = str.substring(startIndex, match.index);
        
        // add the substring to the current query
        curSQLQuery.append(substr);
        
        // start a new query
        curSQLQuery = new SQLQuery();
        spltSQLQueries.push(curSQLQuery);
        
        startIndex = match.index + match[0].length;
      }
      
      // add the remainder of the string to the current query
      curSQLQuery.append(str.substring(startIndex));
      
      // add the following value to the current query (if there is one)
      if (i < this.strings.length - 1) {
        curSQLQuery.appendValue(this.values[i]);
      }
    }
    
    return spltSQLQueries;
  }
  
  /**
   * Returns if this SQL query is completly empty including whitespace
   * and contains no variables.
   * 
   * See `SQL.prototype.isWhitespaceOnly()`
   * 
   * Example:
```
SQL``      .isEmpty(); // true  - {text: '', values: []}
SQL`    `  .isEmpty(); // false - {text: '    ', values: []}
SQL`SELECT`.isEmpty(); // false - {text: 'SELECT', values: []}
SQL`${''}` .isEmpty(); // false - {text: '', values: ['']}
```
   * 
   * @returns {boolean}
   */
  isEmpty() {
    // the query is empty if it contains exactly 1 empty string and 0 values
    if (this.strings.length > 1 || this.values.length > 0) {
      return false;
    }
    return this.strings[0].length === 0;
  }
  
  /**
   * Returns if this SQL query contains only whitespace and no variables.
   * 
   * Example:
```
SQL``      .isEmpty(); // true  - {text: '', values: []}
SQL`    `  .isEmpty(); // true  - {text: '    ', values: []}
SQL`SELECT`.isEmpty(); // false - {text: 'SELECT', values: []}
SQL`${''}` .isEmpty(); // false - {text: '', values: ['']}
```
   * 
   * @returns {boolean}
   */
  isWhitespaceOnly() {
    if (this.strings.length > 1 || this.values.length > 0) {
      return false;
    }
    return /^\s*$/.test(this.strings[0]);
  }
  
  get text() {
    return this.strings.reduce((previousStr, currentStr, index) => previousStr + '$' + index + currentStr);
  }
}

/**
 * SQL tag. Example:
```
SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`
```
 * 
 * Expressions (${}) in SQL tagged template strings are replaced with SQL variable
 * substitutions. The above returns a SQL query object which has the form:
```javascript
{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```
 * 
 * This SQL query can be passed directly to many SQL clients:
 ```javascript
pg.getPool().query(SQL`SELECT name FROM person WHERE id = ${myId}`);
```
 * 
 * Nested SQL queries are combined as expected:
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
 * 
 * To prevent a variable string from being replaced, wrap the string in a SQL
 * query. Example:
```
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
 * 
 * You can also use the alternate build style. See `SQL.build`. Example:
```
SQL('SELECT name FROM person WHERE first_name = ', firstName, ' AND last_name = ', lastName)
// Equivalent to:
SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`;

{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```
 * 
 * Easily combine SQL queries and values in multiple ways:
```
const conditionSQLs = [
  SQL`first_name = ${firstName}`,
  SQL`last_name = ${lastName}`,
  'birthday IS NOT NULL'
];
const orderSQL = SQL`ORDER BY birthday ASC`;
const myIds = [31, 45, 22]
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
 * 
 * @param {string[]} strings 
 * @param  {...any} values 
 * @returns {SQLQuery}
 */
function SQL(strings, ...values) {
  if (Array.isArray(strings)) {
    return new SQLQuery(strings, values);
  }
  
  return SQL.build(...arguments);
}

/**
 * An alternate way of building a query. Start with a string then alternate
 * strings and values.
 * 
 * Example:
```
SQL('SELECT name FROM person WHERE first_name = ', firstName, ' AND last_name = ', lastName);
// Equivalent to:
SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`;

{
  text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
  values: ['Bob', 'Smith']
}
```
 * 
 * @param {any[]} strings 
 * @returns {SQLQuery}
 */
SQL.build = function build(...strsAndVals) {
  const strings = [];
  const values = [];
  
  strings.push(strsAndVals[0] || '');
  
  for (let i = 1; i < strsAndVals.length; i+=2) {
    values .push(strsAndVals[i]);
    strings.push(strsAndVals[i + 1] || '');
  }
  
  return new SQLQuery(strings, values);
};

/**
 * Joins multiple SQL queries and/or strings into a single SQL query with an optional
 * seperator. Similar to `Array.pototype.join`.
 * 
 * Example:
```
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
 * 
 * @param {(SQLQuery|string)[]} sqls
 * @param {SQLQuery|string} seperator Defaults to ','
 * @returns {SQLQuery}
 */
SQL.join = function join(sqls, seperator = ',') {
  const sqlQuery = new SQLQuery();
  for (let i = 0; i < sqls.length; ++i) {
    if (i > 0) {
      sqlQuery.append(seperator);
    }
    
    sqlQuery.append(sqls[i]);
  }
  
  return sqlQuery;
};

/**
 * Joins values into a single SQL query with an optional seperator. Similar to
 * `Array.pototype.join`
 * 
 * Example:
```
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
 * 
 * @param {any[]} vals
 * @param {SQLQuery|string} seperator Defaults to ','
 * @returns {SQLQuery}
 */
SQL.joinValues = function joinValues(vals, seperator = ',') {
  const sqlQuery = new SQLQuery();
  for (let i = 0; i < vals.length; ++i) {
    if (i > 0) {
      sqlQuery.append(seperator);
    }
    
    sqlQuery.appendValue(vals[i]);
  }
  
  return sqlQuery;
};

/**
 * Returns if the given value is a SQL query object.
 * 
 * Example:
```
SQL.isSQL(SQL`SELECT 1`); // true
SQL.isSQL('SELECT 1'); // false
```
 * 
 * @param {any} val
 * @returns {boolean}
 */
SQL.isSQL = function isSQL(val) {
  return val instanceof SQLQuery;
};

SQL.SQLQuery = SQLQuery;

module.exports = SQL;



// https://stackoverflow.com/a/6969486
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
