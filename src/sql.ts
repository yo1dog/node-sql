/* eslint-disable @typescript-eslint/naming-convention */
/**
 * SQL tag. Example:
 * ```javascript
 * SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`
 * ```
 * 
 * Expressions (${}) in SQL tagged template strings are replaced with SQL variable
 * substitutions. The above returns a SQL query object which has the form:
 * ```javascript
 * {
 *   text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
 *   values: ['Bob', 'Smith']
 * }
 * ```
 * 
 * This SQL query can be passed directly to many SQL clients:
 * ```javascript
 * pg.getPool().query(SQL`SELECT name FROM person WHERE id = ${myId}`);
 * ```
 * 
 * Nested SQL queries are combined as expected:
 * ```javascript
 * const sqlA = SQL`SELECT name`;
 * const sqlB = SQL`first_name = ${firstName}`;
 * const sqlC = SQL`last_name = ${lastName}`;
 * SQL`${sqlA} FROM person WHERE ${sqlB} AND ${sqlC}`;
 * 
 * // Equivalent to:
 * {
 *   text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
 *   values: ['Bob', 'Smith']
 * }
 * ```
 * 
 * To prevent a variable SQL string from being substituted, wrap the string in a SQL
 * query. Example:
 * ```javascript
 * const tableName = 'person';
 * SQL`SELECT name FROM ${tableName     } WHERE id = ${myId}`
 * SQL`SELECT name FROM ${SQL(tableName)} WHERE id = ${myId}`
 * 
 * // Equivalent to:
 * {text: 'SELECT name FROM $1 WHERE id = $2', values: [tableName, myId]} // ERROR! Invalid SQL
 * {text: 'SELECT name FROM person WHERE id = $1', values: [myId]} // correct
 * ```
 * 
 * You can also use an alternate build style. See `SQL.build`. Example:
 * ```javascript
 * SQL('SELECT name FROM person WHERE first_name = ', firstName, ' AND last_name = ', lastName)
 * 
 * // Equivalent to:
 * SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`;
 * ```
 * 
 * Easily combine SQL queries and values in multiple ways:
 * ```javascript
 * const conditionSQLs = [
 *   SQL`first_name = ${firstName}`,
 *   SQL`last_name = ${lastName}`,
 *   'birthday IS NOT NULL'
 * ];
 * const orderSQL = SQL`ORDER BY birthday ASC`;
 * const myIds = [31, 45, 22]
 * 
 * SQL`
 *   SELECT name
 *   FROM ${SQL(tableName)}
 *   WHERE
 *     ${SQL.join(conditionSQLs, ' AND ')}
 *     OR id IN (${SQL.joinValues(myIds)})
 *   ${orderSQL}
 * `;
 * 
 * // Equivalent to:
 * {
 *   text: `
 *     SELECT name
 *     FROM person
 *     WHERE
 *       first_name = $1 AND last_name = $2 AND birthday IS NOT NULL
 *       OR id IN ($3, $4, $5)
 *     ORDER BY birthday ASC
 *   `,
 *   values: [firstName, lastName, 31, 45, 22]
 * }
 * ```
 */
export function SQL(...strsAndVals: any[]): SQL.SQLQuery;
export function SQL(strings: string[] | TemplateStringsArray, ...values: any[]): SQL.SQLQuery;
export function SQL(strings: string[] | TemplateStringsArray | string, ...values: any[]): SQL.SQLQuery {
  if (Array.isArray(strings)) {
    return new SQL.SQLQuery(strings, values);
  }
  
  // eslint-disable-next-line prefer-rest-params
  return SQL.build(...arguments);
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SQL {
  export class SQLQuery {
    public readonly strings: string[];
    public readonly values: any[];
    
    /**
     * Creates a SQL query object. Used internally by SQL.
     */
    constructor(origStrings?: string[] | readonly string[] | string, origValues?: any[]) {
      if (!Array.isArray(origStrings)) {
        if (origStrings === undefined) {
          origStrings = [''];
        }
        else {
          origStrings = [origStrings as string];
        }
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
     * ```javascript
     * const sql = SQL`SELECT `;
     * sql.append('name FROM person ').append(SQL`WHERE id = ${id}`);
     * 
     * // Equivalent to:
     * SQL`SELECT name FROM person WHERE id = ${id}`
     * ```
     */
    append(sql: SQLQuery | string) {
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
     * ```javascript
     * const sql = SQL`SELECT name FROM person WHERE id = `;
     * sql.appendValue(id);
     *
     * // Equivalent to:
     * SQL`SELECT name FROM person WHERE id = ${id}`
     * ```
     */
    appendValue(val: any) {
      this.values.push(val);
      this.strings.push('');
      
      return this;
    }
    
    /**
     * Splits this SQL query into multiple SQL queries.
     * 
     * Example:
     * ```javascript
     * const sql = SQL`WHERE first_name = ${firstName} AND last_name = ${lastName} AND birthday IS NOT NULL`;
     * sql.split('AND')
     * 
     * // Equivalent to:
     * [
     *   SQL`WHERE first_name = ${firstName} `,
     *   SQL` last_name = ${lastName} `,
     *   SQL` birthday IS NOT NULL`
     * ]
     * ```
     */
    split(seperator: string | RegExp) {
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
     * See `isWhitespaceOnly()`
     * 
     * Example:
     * ```javascript
     * SQL``      .isEmpty(); // true
     * SQL`    `  .isEmpty(); // false
     * SQL`SELECT`.isEmpty(); // false
     * SQL`${''}` .isEmpty(); // false
     * ```
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
     * ```javascript
     * SQL``      .isEmpty(); // true
     * SQL`    `  .isEmpty(); // true
     * SQL`SELECT`.isEmpty(); // false
     * SQL`${''}` .isEmpty(); // false
     * ```
     */
    isWhitespaceOnly() {
      if (this.strings.length > 1 || this.values.length > 0) {
        return false;
      }
      return /^\s*$/.test(this.strings[0]);
    }
    
    /**
     * Returns the text portion of the SQL query with variable
     * substitutions.
     * 
     * Example:
     * ```javascript
     * const sql = SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName} AND birthday IS NOT NULL`;
     * sql.text
     * 
     * // Equivalent to:
     * 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2 AND birthday IS NOT NULL'
     * ```
     */
    get text() {
      return this.strings.reduce((previousStr, currentStr, index) => previousStr + '$' + index.toString() + currentStr);
    }
  }
  
  /**
   * An alternate way of building a query. Start with a string then alternate
   * strings and values.
   * 
   * Example:
   * ```javascript
   * SQL('SELECT name FROM person WHERE first_name = ', firstName, ' AND last_name = ', lastName);
   * 
   * // Equivalent to:
   * SQL`SELECT name FROM person WHERE first_name = ${firstName} AND last_name = ${lastName}`;
   * 
   * // Equivalent to:
   * {
   *   text: 'SELECT name FROM person WHERE first_name = $1 AND last_name = $2',
   *   values: [firstName, lastName]
   * }
   * ```
   */
  export function build(...strsAndVals: any[]) {
    const strings = [];
    const values = [];
    
    strings.push(strsAndVals[0] || '');
    
    for (let i = 1; i < strsAndVals.length; i+=2) {
      values .push(strsAndVals[i]);
      strings.push(strsAndVals[i + 1] || '');
    }
    
    return new SQLQuery(strings, values);
  }
  
  /**
   * Joins multiple SQL queries and/or strings into a single SQL query with an optional
   * seperator. Similar to `Array.pototype.join`.
   * 
   * Example:
   * ```javascript
   * SQL.join([
   *   SQL`first_name = ${firstName}`,
   *   SQL`last_name = ${lastName}`,
   *   'birthday IS NULL'
   * ], ' AND ')
   * 
   * // Equivalent to:
   * SQL`first_name = ${firstName} AND last_name = ${lastName} AND birthday IS NULL`
   * ```
   */
  export function join(sqls: (SQLQuery|string)[], seperator: SQLQuery|string = ',') {
    const sqlQuery = new SQLQuery();
    for (let i = 0; i < sqls.length; ++i) {
      if (i > 0) {
        sqlQuery.append(seperator);
      }
      
      sqlQuery.append(sqls[i]);
    }
    
    return sqlQuery;
  }
  
  /**
   * Joins values into a single SQL query with an optional seperator. Similar to
   * `Array.pototype.join`
   * 
   * Example:
   * ```javascript
   * SQL`
   *   INSERT INTO table VALUES
   *     (${SQL.joinValues([a, b c], '), (')})
   *   WHERE id IN (${SQL.joinValues([31, 45, 22])})
   * `
   * 
   * // Equivalent to:
   * SQL`
   *   INSERT INTO table VALUES
   *     (${a}), (${b}), (${c})
   *   WHERE id IN (${31}, ${45}, ${22})
   * `
   * ```
   */
  export function joinValues(vals: any[], seperator: SQLQuery|string = ',') {
    const sqlQuery = new SQLQuery();
    for (let i = 0; i < vals.length; ++i) {
      if (i > 0) {
        sqlQuery.append(seperator);
      }
      
      sqlQuery.appendValue(vals[i]);
    }
    
    return sqlQuery;
  }
  
  /**
   * Returns if the given value is a SQL query object.
   * 
   * Example:
   * ```javascript
   * SQL.isSQL(SQL`SELECT 1`); // true
   * SQL.isSQL('SELECT 1'); // false
   * ```
   */
  export function isSQL(val: any): val is SQLQuery {
    return val instanceof SQLQuery;
  }
  
  /**
   * Returns SQL query for a quoted indentifier. Multiple indentifiers will be delimited. Handles
   * escaping of double quotes.
   * 
   * Example:
   * ```javascript
   * const tableName = 'Person';
   * const columnName = 'Birthday';
   * SQL`SELECT ${SQL.identifier(tableName, columnName) FROM ${SQL.identifier(tableName)}`
   * 
   * // Equivalent to:
   * {
   *   text: `SELECT "Person"."Birthday" FROM "Person"`,
   *   values: []
   * }
   * ```
   */
  export function identifier(...identifiers: string[]) {
    return SQL(
      identifiers
      .map(part => `"${part.replace(/"/g, '""')}"`)
      .join('.')
    );
  }
}

// https://stackoverflow.com/a/6969486
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


export default SQL;