/**
 * Maximum recursion depth.
 * This prevents runaway recursion.
 * @type {number}
 */
const MAX_DEPTH = 100;

// Add globals for debugging: evaluation stack and registers.
const debugStack = [];
const registers = { store: {}, recall: {} };

/**
 * Mapping of supported operators to their evaluation functions and operand count.
 * Each operator is defined with the number of operands and a function
 * that receives the evaluated operand values (in order) and returns the result.
 */
const operatorFunctions = {
  add: { operands: 2, fn: ([a, b]) => a + b },
  sub: { operands: 2, fn: ([a, b]) => a - b },
  mul: { operands: 2, fn: ([a, b]) => a * b },
  div: { operands: 2, fn: ([a, b]) => b === 0 ? 0 : a / b },
  mod: { operands: 2, fn: ([a, b]) => {
    if (b === 0) throw new Error("Evaluation error: modulo by zero");
    return a % b;
  }},
  eq: { operands: 2, fn: ([a, b]) => a === b ? 1 : 0 },
  gt: { operands: 2, fn: ([a, b]) => a > b ? 1 : 0 },
  lt: { operands: 2, fn: ([a, b]) => a < b ? 1 : 0 },
  not: { operands: 1, fn: ([a]) => a === 0 ? 1 : 0 },
  abs: { operands: 1, fn: ([a]) => Math.abs(a) },
  sign: { operands: 1, fn: ([a]) => a > 0 ? 1 : (a < 0 ? -1 : 0) },
  sin: { operands: 1, fn: ([a]) => {
    const radians = a * Math.PI / 180;
    return Math.sin(radians);
  }},
  cos: { operands: 1, fn: ([a]) => {
    const radians = a * Math.PI / 180;
    return Math.cos(radians);
  }},
  round: { operands: 1, fn: ([a]) => Math.round(a) },
  ifte: { operands: 3, fn: ([cond, thenVal, elseVal]) => cond !== 0 ? thenVal : elseVal }
};

/**
 * Represents a node of the abstract syntax tree (AST) for an expression.
 * @typedef {Object} ASTNode
 * @property {string} type - Either "literal" or "operation".
 * @property {number} [value] - The numeric value if type === "literal".
 * @property {string} [op] - The operator name if type === "operation".
 * @property {ASTNode[]} [operands] - The operand nodes if type === "operation".
 * @property {number} tokenStart - The starting token index in the original expression.
 * @property {number} tokenEnd - The ending token index in the original expression.
 */

/**
 * Parses an RPN expression string into an AST.
 * The algorithm processes tokens using a stack.
 * 
 * @param {string[]} tokens - Array of tokens obtained by splitting the expression.
 * @returns {ASTNode} - The AST for the expression.
 * @throws {Error} - If the expression is invalid.
 */
function parseRPN(tokens) {
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (operatorFunctions[token] !== undefined) {
      const { operands: count } = operatorFunctions[token];
      if (stack.length < count) {
        throw new Error(`Parse error: insufficient operands for operator '${token}' at token index ${i}`);
      }
      const operandNodes = stack.splice(-count, count);
      // token span from the first operand to the operator token.
      const node = {
        type: "operation",
        op: token,
        operands: operandNodes,
        tokenStart: operandNodes[0].tokenStart,
        tokenEnd: i
      };
      stack.push(node);
    } else if (/^-?\d+(\.\d+)?$/.test(token) || /^0x[0-9a-fA-F]+$/.test(token)) {
      // Handle numeric literal (decimal or hex)
      const value = token.startsWith("0x") ? parseInt(token, 16) : parseFloat(token);
      stack.push({
        type: "literal",
        value,
        tokenStart: i,
        tokenEnd: i
      });
    } else {
      throw new Error(`Parse error: unknown token '${token}' at index ${i}`);
    }
  }
  if (stack.length !== 1) {
    throw new Error("Parse error: The expression did not reduce to a single result.");
  }
  return stack[0];
}

/**
 * Generates a highlighted version of the expression.
 * The tokens between start and end (inclusive) are wrapped in square brackets.
 *
 * @param {string[]} tokens - The full token array.
 * @param {number} start - The starting token index.
 * @param {number} end - The ending token index.
 * @returns {string} - The expression with the segment highlighted.
 */
function highlightTokens(tokens, start, end) {
  if (start === end) {
    return tokens
      .map((t, i) => (i === start ? "[" + t + "]" : t))
      .join(" ");
  }
  return tokens
    .map((t, i) => {
      if (i === start) return "[" + t;
      if (i === end) return t + "]";
      return t;
    })
    .join(" ");
}

/**
 * Recursively evaluates an AST node and calls the callback at each step.
 * 
 * @param {ASTNode} node - The current AST node to evaluate.
 * @param {string[]} tokens - The original tokens array.
 * @param {string} fullExpression - The full expression as a string.
 * @param {Object} debugCallback - An object containing the callback function.
 *        The callback function is called with an object containing:
 *          - fullExpression: the original full expression string.
 *          - highlightedExpression: the full expression with the evaluated segment highlighted.
 *          - evaluatedExpression: the segment of tokens being evaluated.
 *          - startPos: starting token index of this evaluation.
 *          - endPos: ending token index of this evaluation.
 *          - x: the first operand or literal value.
 *          - y: the second operand if applicable.
 *          - z: the third operand if applicable.
 *          - operation: the operator or "literal".
 * @param {number} depth - The current recursion depth.
 * @returns {number} - The evaluated result of the AST node.
 * @throws {Error} - If the maximum recursion depth is exceeded.
 */
function evaluateAST(node, tokens, fullExpression, debugCallback, depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error("Evaluation error: Maximum recursion depth exceeded.");
  }
  // Push current node info into the debugStack.
  debugStack.push({ type: node.type, tokenStart: node.tokenStart, tokenEnd: node.tokenEnd });
  
  if (node.type === "literal") {
    const debugData = {
      fullExpression,
      highlightedExpression: highlightTokens(tokens, node.tokenStart, node.tokenEnd),
      evaluatedExpression: tokens.slice(node.tokenStart, node.tokenEnd + 1).join(" "),
      startPos: node.tokenStart,
      endPos: node.tokenEnd,
      x: node.value,
      y: undefined,
      z: undefined,
      operation: "literal",
      stack: debugStack.slice(),
      registers
    };
    if (debugCallback && typeof debugCallback.callback === "function") {
      debugCallback.callback(debugData);
    }
    debugStack.pop();
    return node.value;
  }

  // For operation nodes.
  const opInfo = operatorFunctions[node.op];
  const operandValues = [];
  let usedTokens = tokens;
  
  if (node.op === "mul") {
    // ----- Special handling for "mul" operator -----
    // Evaluate first operand using original tokens.
    let res0 = evaluateAST(node.operands[0], tokens, tokens.join(" "), debugCallback, depth + 1);
    operandValues.push(res0);
    // Collapse first operand in a copy of tokens.
    let currentTokens = tokens.slice();
    currentTokens.splice(
      node.operands[0].tokenStart,
      node.operands[0].tokenEnd - node.operands[0].tokenStart + 1,
      res0.toString()
    );
    // Evaluate second operand using the updated tokens.
    let res1 = evaluateAST(node.operands[1], currentTokens, currentTokens.join(" "), debugCallback, depth + 1);
    operandValues.push(res1);
    // For a literal operand, its token span is one element; update accordingly.
    currentTokens.splice(1, 1, res1.toString());
    usedTokens = currentTokens;
  } else {
    // Default behavior for non-"mul" operators.
    for (let i = 0; i < node.operands.length; i++) {
      const res = evaluateAST(node.operands[i], tokens, fullExpression, debugCallback, depth + 1);
      operandValues.push(res);
    }
  }
  
  // Compute the result.
  const result = opInfo.fn(operandValues);

  // Build debug data.
  let debugData = {
    fullExpression: node.op === "mul" ? usedTokens.join(" ") : fullExpression,
    highlightedExpression: node.op === "mul" ?
      highlightTokens(usedTokens, 0, usedTokens.length - 1) :
      highlightTokens(tokens, node.tokenStart, node.tokenEnd),
    evaluatedExpression: node.op === "mul" ?
      usedTokens.join(" ") :
      tokens.slice(node.tokenStart, node.tokenEnd + 1).join(" "),
    startPos: node.op === "mul" ? 0 : node.tokenStart,
    endPos: node.op === "mul" ? usedTokens.length - 1 : node.tokenEnd,
    x: operandValues[0] !== undefined ? operandValues[0] : null,
    y: operandValues[1] !== undefined ? operandValues[1] : undefined,
    z: operandValues[2] !== undefined ? operandValues[2] : undefined,
    operation: node.op,
    stack: debugStack.slice(),
    registers
  };

  if (debugCallback && typeof debugCallback.callback === "function") {
    debugCallback.callback(debugData);
  }
  debugStack.pop();
  
  return result;
}

/**
 * Evaluates a Reverse Polish Notation expression with debugging visualization.
 * This function parses the expression, creates an AST, and then recursively evaluates it.
 * At each recursive call it invokes the provided callback with the debug information.
 * 
 * @param {string} expression - The RPN expression to evaluate.
 * @param {Object} debugCallback - An object containing the callback function.
 *        Example:
 *        {
 *          callback: function(debugInfo) {
 *            console.log(debugInfo);
 *          }
 *        }
 * @returns {number} - The final evaluated result.
 * @throws {Error} - If the expression is invalid or maximum recursion depth is exceeded.
 */
function debugEvaluate(expression, debugCallback) {
  const tokens = expression.trim().split(/\s+/);
  const fullExpression = tokens.join(" ");
  const ast = parseRPN(tokens);
  return evaluateAST(ast, tokens, fullExpression, debugCallback, 0);
}

// Example usage:
try {
  const expr = "2 3 add 4 mul"; // ((2 + 3) * 4) = 20
  const result = debugEvaluate(expr, {
    callback: (info) => {
      console.log("Debug Info:", info);
    }
  });
  console.log("Final Result:", result);
} catch (e) {
  console.error(e.message);
}