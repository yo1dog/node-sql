/* eslint-disable @typescript-eslint/unified-signatures,@typescript-eslint/naming-convention */

/**
 * Coerces the given value to a `SQLQuery`. If a `SQLQuery` is given it is returned as-is (it is not
 * cloned: see `sqlQuery.clone`). If a string is given a new `SQLQuery` is created using the string
 * as the query's text (without variable substitution).
 * 
 * Example:
 * ```javascript
 * const tableName = 'person';
 * SQL`SELECT * FROM ${SQL(tableName)} WHERE id = ${id}`
 * 
 * // Equivalent to:
 * SQL`SELECT * FROM person WHERE id = ${id}`
 * ```
 */
export function SQL(sqlOrText: SQL.SQLQuery | string): SQL.SQLQuery;

/**
 * Coerces the given value to a `SQLQuery`. If a `SQLQuery` is given it is returned as-is (it is not
 * cloned: see `sqlQuery.clone`). If a string is given a new `SQLQuery` is created using the string
 * as the query's text (without variable substitution).
 * 
 * Example:
 * ```javascript
 * const tableName = 'person';
 * SQL`SELECT * FROM ${SQL(tableName)} WHERE id = ${id}`
 * 
 * // Equivalent to:
 * SQL`SELECT * FROM person WHERE id = ${id}`
 * ```
 */
export function SQL(): SQL.SQLQuery;

/**
 * Used to power tagged template literals.
 * 
 * Use `SQL` as a template tag to create a `SQLQuery`. Expressions (`${}`) in `SQL` tagged templates
 * are replaced with SQL variable substitutions. Nesting of `SQLQuery` is supported.
 * 
 * Example:
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
 */
export function SQL(strings: TemplateStringsArray, ...values: any[]): SQL.SQLQuery;

export function SQL(arg1?: TemplateStringsArray | SQL.SQLQuery | string, ...values: any[]): SQL.SQLQuery {
  if (Array.isArray(arg1)) {
    return fromTaggedTemplate(arg1 as TemplateStringsArray, values);
  }
  if (arg1 instanceof SQL.SQLQuery) {
    return arg1;
  }
  if (arguments.length === 0) {
    return new SQL.SQLQuery();
  }
  return new SQL.SQLQuery([arg1 as string], []);
}

function fromTaggedTemplate(strings: TemplateStringsArray, values: any[]): SQL.SQLQuery {
  const sqlQuery = new SQL.SQLQuery([], []);
  
  // add the first string
  sqlQuery.strings.push(strings[0]);
  
  // for each value...
  for (let i = 0; i < values.length; ++i) {
    const value = values[i];
    const followingStr = strings[i + 1];
    
    // check if the value is a query
    if (value instanceof SQL.SQLQuery) {
      // append the query and the following string
      sqlQuery.append(value);
      sqlQuery.strings[sqlQuery.strings.length - 1] += followingStr;
    }
    else {
      // add the value and the following string
      sqlQuery.values.push(value);
      sqlQuery.strings.push(followingStr);
    }
  }
  
  return sqlQuery;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SQL {
  export class SQLQuery {
    public readonly strings: string[];
    public readonly values: any[];
    
    /**
     * Used internally. To create a `SQLQuery` use `SQL` as a template literal tag or use the `SQL`
     * and `SQL.build` functions.
     */
    constructor();
    constructor(strings: string[], values: any[]);
    constructor(strings?: string[], values?: any[]) {
      this.strings = strings || [''];
      this.values = values || [];
    }
    
    protected appendSQL(sql: SQLQuery): this {
      // append the query's first string to the last string
      this.strings[this.strings.length - 1] += sql.strings[0];
      
      // add the rest of the query's strings and values
      for (let j = 0; j < sql.values.length; ++j) {
        this.values.push(sql.values[j]);
        this.strings.push(sql.strings[j + 1]);
      }
      
      return this;
    }
    protected appendText(text: string): this {
      this.strings[this.strings.length - 1] += text;
      return this;
    }
    protected appendValue(val: any): this {
      this.values.push(val);
      this.strings.push('');
      return this;
    }
    
    /**
     * If a `SQLQuery` is given, it is appended to the end of this `SQLQuery`. Otherwise, the value
     * is appended to the end of this `SQLQuery` using variable substitution.
     * 
     * Example:
     * ```javascript
     * const sql = SQL`SELECT `;
     * sql.append(SQL`name FROM person WHERE id = `).append(id);
     * 
     * // Equivalent to:
     * SQL`SELECT name FROM person WHERE id = ${id}`
     * ```
     */
    append(sqlOrVal: any): this {
      if (sqlOrVal instanceof SQLQuery) {
        return this.appendSQL(sqlOrVal);
      }
      return this.appendValue(sqlOrVal);
    }
    
    /**
     * If a `SQLQuery` is given, it is appended to the end of this `SQLQuery`. If a string is given,
     * it is appended to the end of this `SQLQuery`'s text (without variable substitution).
     * 
     * Example:
     * ```javascript
     * const sql = SQL`SELECT `;
     * sql.appendQuery(SQL`name FROM person WHERE id = ${id}`).appendQuery(' AND name IS NOT NULL');
     * 
     * // Equivalent to:
     * SQL`SELECT name FROM person WHERE id = ${id} AND name IS NOT NULL`
     * ```
     */
    appendQuery(sqlOrText: SQLQuery | string): this {
      if (sqlOrText instanceof SQLQuery) {
        return this.appendSQL(sqlOrText);
      }
      return this.appendText(sqlOrText);
    }
    
    /**
     * Splits this `SQLQuery` into multiple `SQLQuery`s.
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
    split(separator: string | RegExp): SQLQuery[] {
      let regex;
      if (separator instanceof RegExp) {
        regex = separator;
      }
      else {
        regex = new RegExp(escapeRegExp(separator), 'g');
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
          curSQLQuery.appendText(substr);
          
          // start a new query
          curSQLQuery = new SQLQuery();
          spltSQLQueries.push(curSQLQuery);
          
          startIndex = match.index + match[0].length;
        }
        
        // add the remainder of the string to the current query
        curSQLQuery.appendText(str.substring(startIndex));
        
        // add the following value to the current query (if there is one)
        if (i < this.strings.length - 1) {
          curSQLQuery.appendValue(this.values[i]);
        }
      }
      
      return spltSQLQueries;
    }
    
    /**
     * Returns if this `SQLQuery` is completely empty including whitespace and contains no variable
     * substitutions.
     * 
     * Example:
     * ```javascript
     * SQL``      .isEmpty(); // true
     * SQL`    `  .isEmpty(); // false
     * SQL`SELECT`.isEmpty(); // false
     * SQL`${''}` .isEmpty(); // false
     * ```
     */
    isEmpty(): boolean {
      // the query is empty if it contains exactly 1 empty string and 0 values
      if (this.strings.length > 1 || this.values.length > 0) {
        return false;
      }
      return this.strings[0].length === 0;
    }
    
    /**
     * Returns if this `SQLQuery` contains only whitespace and no variable substitutions.
     * 
     * Example:
     * ```javascript
     * SQL``      .isWhitespaceOnly(); // true
     * SQL`    `  .isWhitespaceOnly(); // true
     * SQL`SELECT`.isWhitespaceOnly(); // false
     * SQL`${''}` .isWhitespaceOnly(); // false
     * ```
     */
    isWhitespaceOnly(): boolean {
      if (this.strings.length > 1 || this.values.length > 0) {
        return false;
      }
      return /^\s*$/.test(this.strings[0]);
    }
    
    /**
     * Returns a copy of this `SQLQuery`. Note that this is a "shallow" clone in that the values
     * referenced by this query are not themselves cloned.
     * 
     * Example:
     * ```javascript
     * const a = SQL`SELECT name FROM person WHERE id = ${id}`;
     * const b = a.clone();
     * b.append(SQL` AND birthday IS NOT NULL`);
     * 
     * // Equivalent to:
     * const b = SQL`${a} AND birthday IS NOT NULL`;
     * ```
     */
    clone(): SQLQuery {
      return new SQLQuery(this.strings.slice(0), this.values.slice(0));
    }
    
    /**
     * Returns the text portion of this `SQLQuery` with variable substitutions.
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
    get text(): string {
      return this.strings.reduce((previousStr, currentStr, index) => previousStr + '$' + index.toString() + currentStr);
    }
  }
  
  /**
   * An alternate way of building a query. Start with a string then alternate values and strings.
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
  export function build(...strsAndVals: any[]): SQLQuery {
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
   * Joins multiple SQL queries and/or values into a single `SQLQuery`. If a `SQLQuery` is given it
   * is appened to the end of the `SQLQuery`. Otherwise, the value is appended to the end of the SQL
   * query (using variable substitution).
   * 
   * Separator can be a text string or a `SQLQuery` and defaults to `,`.
   * 
   * Similar to `Array.pototype.join`.
   * 
   * Example:
   * ```javascript
   * SQL.join([
   *   SQL`first_name = ${firstName}`,
   *   SQL`last_name = ${lastName}`,
   *   hasBirthday
   * ], ' AND ');
   * 
   * // Equivalent to:
   * SQL`first_name = ${firstName} AND last_name = ${lastName} AND ${hasBirthday}`
   * ```
   */
  export function join(sqlOrVals: any[], separator: SQLQuery | string = ','): SQLQuery {
    const sqlQuery = new SQLQuery();
    for (let i = 0; i < sqlOrVals.length; ++i) {
      if (i > 0) {
        sqlQuery.appendQuery(separator);
      }
      
      sqlQuery.append(sqlOrVals[i]);
    }
    
    return sqlQuery;
  }
  
  /**
   * Joins multiple SQL queries and/or text strings into a single `SQLQuery`. If a `SQLQuery` is
   * given it is appended to the end of the `SQLQuery`. If a string is given, it is appended to the
   * end of the `SQLQuery`'s text (without variable substitution).
   * 
   * Separator can be a text string or a `SQLQuery` and defaults to `,`.
   * 
   * Similar to `Array.pototype.join`.
   * 
   * Example:
   * ```javascript
   * SQL.joinQueries([
   *   SQL`first_name = ${firstName}`,
   *   SQL`last_name = ${lastName}`,
   *   'birthday IS NOT NULL'
   * ], ' AND ');
   * 
   * // Equivalent to:
   * SQL`first_name = ${firstName} AND last_name = ${lastName} AND birthday IS NOT NULL`
   * ```
   */
  export function joinQueries(sqlOrTexts: (SQLQuery | string)[], separator: SQLQuery | string = ','): SQLQuery {
    const sqlQuery = new SQLQuery();
    for (let i = 0; i < sqlOrTexts.length; ++i) {
      if (i > 0) {
        sqlQuery.appendQuery(separator);
      }
      
      sqlQuery.appendQuery(sqlOrTexts[i]);
    }
    
    return sqlQuery;
  }
  
  /**
   * Returns if the given value is an instance of `SQLQuery`.
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
}

// https://stackoverflow.com/a/6969486
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


export const sql = SQL;
