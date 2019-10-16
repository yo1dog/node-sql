declare class SQLQuery {
  /**
   * Creates a SQL query object. Used internally by SQL.
   */
  public constructor(origStrings: string[], origValues: any[]);
  
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
  public append(sql: SQLQuery | string): SQLQuery;
  
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
  public appendValue(val: any): SQLQuery;
  
  /**
   * Makes a half-hearted attempt to format this SQL query into
   * a human-friendly string.
   */
  public toPrettyString(): string;
  
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
  public split(seperator: string | RegExp): SQLQuery[];
  
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
  public isEmpty(): boolean;
  
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
  public isWhitespaceOnly(): boolean;
  
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
  public get text(): string;
}

type TSQL = (strings: string[], ...values: any[]) => SQLQuery;

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
interface ISQL extends TSQL {
  readonly SQLQuery: SQLQuery;
  
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
  build(...strsAndVals: any[]): SQLQuery;
  
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
  join(sqls: (SQLQuery|string)[], seperator?: SQLQuery|string): SQLQuery;
  
  /**
   * Joins values into a single SQL query with an optional seperator. Similar to
   * `Array.pototype.join`
   * 
   * Example:
   * ```javascript
   * SQL`
   *   INSERT (${SQL.joinValues([a, b c], '), (')})
   *   INTO table
   *   WHERE id IN (${SQL.joinValues([31, 45, 22])})
   * `
   * 
   * // Equivalent to:
   * SQL`
   *   INSERT (${a}), (${b}), (${c})
   *   INTO table
   *   WHERE id IN (${31}, ${45}, ${22})
   * `
   * ```
   */
  joinValues(vals: any[], seperator?: SQLQuery|string): SQLQuery;
  
  /**
   * Returns if the given value is a SQL query object.
   * 
   * Example:
   * ```javascript
   * SQL.isSQL(SQL`SELECT 1`); // true
   * SQL.isSQL('SELECT 1'); // false
   * ```
   */
  isSQL(val: any): val is SQLQuery;
}

export default ISQL;