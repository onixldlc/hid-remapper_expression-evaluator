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

// Template for simulation environment variables.
// Users can preset these values to control the behavior of random-based operators.
const simulationEnv = {
  input_state: undefined,            // Set to a number (0-255) to control input_state.
  input_state_binary: undefined,     // Set to 0 or 1 to control input_state_binary.
  prev_input_state_binary: undefined // Set to 0 or 1 to control prev_input_state_binary.
};

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
  ifte: { operands: 3, fn: ([cond, thenVal, elseVal]) => cond !== 0 ? thenVal : elseVal },
  
  // --- Existing Operators ---
  input_state: { operands: 1, fn: ([usage]) => {
    return simulationEnv.input_state !== undefined 
      ? simulationEnv.input_state 
      : Math.floor(Math.random() * 256);
  }},
  input_state_binary: { operands: 1, fn: ([usage]) => {
    return simulationEnv.input_state_binary !== undefined 
      ? simulationEnv.input_state_binary 
      : (Math.random() > 0.5 ? 1 : 0);
  }},
  // --- New Operators (already implemented) ---
  prev_input_state_binary: { operands: 1, fn: ([usage]) => {
    return simulationEnv.prev_input_state_binary !== undefined 
      ? simulationEnv.prev_input_state_binary 
      : (Math.random() > 0.5 ? 1 : 0);
  }},
  bitwise_or: { operands: 2, fn: ([a, b]) => a | b },
  dup: { operands: 1, fn: ([a]) => [a, a] },
  store: { operands: 2, fn: ([value, reg]) => {
    registers.store[reg] = value;
    return value;
  }},
  recall: { operands: 1, fn: ([reg]) => {
    return registers.store.hasOwnProperty(reg) ? registers.store[reg] : 0;
  }},
  time: { operands: 0, fn: () => {
    return Date.now();
  }},
  swap: { operands: 2, fn: ([a, b]) => [b, a] },
  
  // --- Additional Operators ---
  input_state_scaled: { operands: 1, fn: ([usage]) => {
    return simulationEnv.input_state_scaled !== undefined 
      ? simulationEnv.input_state_scaled 
      : Math.floor(Math.random() * 256);
  }},
  prev_input_state: { operands: 1, fn: ([usage]) => {
    return simulationEnv.prev_input_state !== undefined 
      ? simulationEnv.prev_input_state 
      : Math.floor(Math.random() * 256);
  }},
  prev_input_state_scaled: { operands: 1, fn: ([usage]) => {
    return simulationEnv.prev_input_state_scaled !== undefined 
      ? simulationEnv.prev_input_state_scaled 
      : Math.floor(Math.random() * 256);
  }},
  min: { operands: 2, fn: ([a, b]) => Math.min(a, b) },
  max: { operands: 2, fn: ([a, b]) => Math.max(a, b) },
  atan2: { operands: 2, fn: ([x, y]) => Math.atan2(x, y) },
  sqrt: { operands: 1, fn: ([x]) => Math.sqrt(x) },
  relu: { operands: 1, fn: ([x]) => x < 0 ? 0 : x },
  clamp: { operands: 3, fn: ([x, y, z]) => x < y ? y : (x > z ? z : x) },
  bitwise_and: { operands: 2, fn: ([a, b]) => a & b },
  bitwise_not: { operands: 1, fn: ([x]) => ~x },
  time_sec: { operands: 0, fn: () => Date.now() / 1000 },
  layer_state: { operands: 0, fn: () => {
    return simulationEnv.layer_state !== undefined 
      ? simulationEnv.layer_state 
      : Math.floor(Math.random() * 256);
  }},
  sticky_state: { operands: 1, fn: ([usage]) => {
    if (simulationEnv.sticky_state && simulationEnv.sticky_state.hasOwnProperty(usage)) {
      return simulationEnv.sticky_state[usage];
    }
    return Math.floor(Math.random() * 256);
  }},
  tap_state: { operands: 1, fn: ([usage]) => {
    return simulationEnv.tap_state !== undefined 
      ? simulationEnv.tap_state 
      : (Math.random() > 0.5 ? 1 : 0);
  }},
  hold_state: { operands: 1, fn: ([usage]) => {
    return simulationEnv.hold_state !== undefined 
      ? simulationEnv.hold_state 
      : (Math.random() > 0.5 ? 1 : 0);
  }},
  port: { operands: 1, fn: ([port]) => {
    simulationEnv.port = port;
    return port;
  }},
  plugged_in: { operands: 0, fn: () => {
    if (simulationEnv.plugged_in !== undefined) return simulationEnv.plugged_in;
    return simulationEnv.port === 0 ? 1 : 0;
  }},
  deadzone: { operands: 3, fn: ([x, y, deadzone]) => {
    let magnitude = Math.sqrt(x * x + y * y);
    if (magnitude < deadzone) {
      return ["0", "0"];
    }
    return [x.toString(), y.toString()];
  }},
  deadzone2: { operands: 4, fn: ([x, y, inner, outer]) => {
    let magnitude = Math.sqrt(x * x + y * y);
    if (magnitude < inner) {
      return ["0", "0"];
    } else if (magnitude > outer) {
      let scale = outer / magnitude;
      return [(x * scale).toString(), (y * scale).toString()];
    }
    return [x.toString(), y.toString()];
  }},
  dpad: { operands: 4, fn: ([left, right, up, down]) => {
    left = Number(left) ? 1 : 0;
    right = Number(right) ? 1 : 0;
    up = Number(up) ? 1 : 0;
    down = Number(down) ? 1 : 0;
    if (up && !right && !down && !left) return 1;
    if (right && !up && !down && !left) return 3;
    if (down && !left && !right && !up) return 5;
    if (left && !up && !down && !right) return 7;
    if (up && right) return 2;
    if (right && down) return 4;
    if (down && left) return 6;
    if (left && up) return 8;
    return 0;
  }},
  monitor: { operands: 2, fn: ([x, usage]) => {
    return x;
  }}
};

/**
 * Simulates RPN evaluation step-by-step and calls debug callbacks.
 * Produces two callbacks per operator: pre-collapse and post-collapse.
 * @param {string} expression - The RPN expression.
 * @param {Object} debugCallback - Object containing a callback function.
 * @returns {number} - Final result.
 */
function simulateRPN(expression, debugCallback) {
  // Remove comment blocks (/* ... */) from the expression.
  expression = expression.replace(/\/\*[\s\S]*?\*\//g, "");
  let tokens = expression.trim().split(/\s+/);

  const updateDebug = (highlightStart, highlightEnd, extra = {}) => {
    if (debugCallback && typeof debugCallback.callback === "function") {
      const exactEvaluation = tokens.slice(highlightStart, highlightEnd + 1).join(" ");
      const defaultData = {
        fullExpression: tokens.join(" "),
        highlightedExpression: highlightTokens(tokens, highlightStart, highlightEnd),
        evaluatedExpression: exactEvaluation,
        plainEvaluation: exactEvaluation,
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
      const evaluatedOperands = operands.map(o => Number(o.value));
      const opResult = opFunc.fn(evaluatedOperands);
      let insertedTokens = [];
      if (Array.isArray(opResult)) {
        insertedTokens = opResult.map(r => r.toString());
        tokens.splice(spanStart, spanEnd - spanStart + 1, ...insertedTokens);
        for (let k = 0; k < insertedTokens.length; k++) {
          stack.push({ value: insertedTokens[k], pos: spanStart + k });
        }
        updateDebug(spanStart, spanStart + insertedTokens.length - 1, { x: insertedTokens.join(" "), operation: "literal" });
        i = spanStart + insertedTokens.length;
      } else {
        insertedTokens = [opResult.toString()];
        tokens.splice(spanStart, spanEnd - spanStart + 1, opResult.toString());
        stack.push({ value: opResult, pos: spanStart });
        updateDebug(spanStart, spanStart, { x: opResult, operation: "literal" });
        i = spanStart + 1;
      }
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
      plainEvaluation: tokens.join(" "),
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

var expression = `
/* register 1 = A is pressed and has priority */
1 recall
0x00070004 prev_input_state_binary not /* A */
bitwise_or /* if A was just pressed, it has priority */
0x00070007 input_state_binary not /* D */
bitwise_or /* if D is not pressed, A has priority */
0x00070007 prev_input_state_binary not /* D */
0x00070007 input_state_binary /* D */
mul
not
mul /* if D was just pressed, A doesn't have priority */
0x00070004 input_state_binary /* A */
mul /* none of the above matters unless A is pressed */
dup
1 store
/* result used as A */
`

// Example usage:
try {
  const expr = expression;
  const result = debugEvaluate(expr, {
    callback: (info) => {
      console.log("Debug Info:", info);
    }
  });
  console.log("Final Result:", result);
} catch (e) {
  console.error(e.message);
}