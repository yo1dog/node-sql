class SQLQuery {
  /**
   * @param {string[] | string} [origStrings] 
   * @param {any[]} [origValues] 
   */
  constructor(origStrings, origValues) {
    if (!Array.isArray(origStrings)) {
      if (typeof origStrings === 'undefined') {
        origStrings = [''];
      }
      else {
        origStrings = [origStrings];
      }
    }
    if (!origValues) {
      origValues = [];
    }
    
    /** @type {string[]} */
    this.strings = [];
    /** @type {any[]} */
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
   * @param {SQLQuery | string} sql 
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
   * @param {any} val 
   */
  appendValue(val) {
    this.values.push(val);
    this.strings.push('');
    
    return this;
  }
  
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
   * @param {string | RegExp} seperator 
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
  
  isEmpty() {
    // the query is empty if it contains exactly 1 empty string and 0 values
    if (this.strings.length > 1 || this.values.length > 0) {
      return false;
    }
    return this.strings[0].length === 0;
  }
  
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
 * @param {TemplateStringsArray|string} strings 
 * @param {...any} values 
 */
function SQL(strings, ...values) {
  if (Array.isArray(strings)) {
    return new SQLQuery(strings, values);
  }
  
  return SQL.build(...arguments);
}

/**
 * @param {...any} strsAndVals
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
 * @param {(SQLQuery|string)[]} sqls
 * @param {SQLQuery|string} [seperator]
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
 * @param {any[]} vals
 * @param {SQLQuery|string} [seperator]
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
 * @param {any} val
 * @returns {val is SQLQuery}
 */
SQL.isSQL = function isSQL(val) {
  return val instanceof SQLQuery;
};

SQL.SQLQuery = SQLQuery;

module.exports = SQL;



// https://stackoverflow.com/a/6969486
/** @param {string} string */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
