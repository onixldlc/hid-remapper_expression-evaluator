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
 * Add missing highlightTokens function.
 */
function highlightTokens(tokens, start, end) {
  if (start === end) {
    return tokens.map((t, i) => i === start ? `[${t}]` : t).join(" ");
  }
  return tokens.map((t, i) => {
    if (i === start) return `[${t}`;
    if (i === end) return `${t}]`;
    return t;
  }).join(" ");
}

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
 * Simulates RPN evaluation step-by-step and calls debug callbacks.
 * Produces two callbacks per operator: pre-collapse and post-collapse.
 * @param {string} expression - The RPN expression.
 * @param {Object} debugCallback - Object containing a callback function.
 * @returns {number} - Final result.
 */
function simulateRPN(expression, debugCallback) {
  let tokens = expression.trim().split(/\s+/);
  const updateDebug = (highlightStart, highlightEnd, extra = {}) => {
    if (debugCallback && typeof debugCallback.callback === "function") {
      const defaultData = {
        fullExpression: tokens.join(" "),
        highlightedExpression: highlightTokens(tokens, highlightStart, highlightEnd),
        evaluatedExpression: tokens.slice(highlightStart, highlightEnd + 1).join(" "),
        startPos: highlightStart,
        endPos: highlightEnd,
        x: null,
        y: null,
        z: null,
        operation: "literal",
        stack: [],
        registers
      };
      debugCallback.callback(Object.assign({}, defaultData, extra));
    }
  };

  // Use a while-loop so we can control skipping operator-generated tokens.
  const stack = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (operatorFunctions[token] === undefined) {
      // Literal token.
      updateDebug(i, i, { x: Number(token), operation: "literal" });
      stack.push({ value: token, pos: i });
      i++;
    } else {
      // Operator token.
      const opFunc = operatorFunctions[token];
      const count = opFunc.operands;
      if (stack.length < count) {
        throw new Error(`Insufficient operands for operator '${token}'`);
      }
      const operands = [];
      for (let j = 0; j < count; j++) {
        operands.unshift(stack.pop());
      }
      const spanStart = operands[0].pos;
      const spanEnd = i;
      // Pre-collapse debug callback.
      updateDebug(spanStart, spanEnd, {
        x: operands[0].value,
        y: operands[1] ? operands[1].value : null,
        z: operands[2] ? operands[2].value : null,
        operation: token
      });
      // Compute result and splice tokens.
      const opResult = opFunc.fn(operands.map(o => Number(o.value)));
      tokens.splice(spanStart, spanEnd - spanStart + 1, opResult.toString());
      // Post-collapse debug callback now logs the collapsed token as literal.
      updateDebug(spanStart, spanStart, { x: opResult, operation: "literal" });
      stack.push({ value: opResult, pos: spanStart });
      // Set i to skip the operator-produced token.
      i = spanStart + 1;
    }
  }
  if (stack.length !== 1) {
    throw new Error("The expression did not reduce to a single result.");
  }
  // Final collapsed state callback.
  if (debugCallback && typeof debugCallback.callback === "function") {
    debugCallback.callback({
      fullExpression: tokens.join(" "),
      highlightedExpression: highlightTokens(tokens, 0, 0),
      evaluatedExpression: tokens.join(" "),
      startPos: 0,
      endPos: 0,
      x: Number(tokens[0]),
      y: undefined,
      z: undefined,
      operation: "final",
      stack: [],
      registers
    });
  }
  return Number(tokens[0]);
}

/**
 * Replaces the old debugEvaluate with one that uses simulateRPN.
 */
function debugEvaluate(expression, debugCallback) {
  return simulateRPN(expression, debugCallback);
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