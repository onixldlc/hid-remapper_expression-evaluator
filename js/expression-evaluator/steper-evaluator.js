/**
 * Maximum recursion depth.
 * This prevents runaway recursion.
 * @type {number}
 */
const MAX_DEPTH = 100;

// Add globals for debugging: evaluation stack and registers.
const debugStack = [];
const registers = {};

/**
 * Add missing highlightTokens function.
 *
 * Highlights tokens by surrounding them with brackets between
 * the specified start and end indices.
 *
 * @param {string[]} tokens - Array of tokens to highlight.
 * @param {number} start - The start index for highlighting.
 * @param {number} end - The end index for highlighting.
 * @returns {string} - The tokens combined into a string with highlights.
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
  // Analog Input Values:
  input_state: undefined,            // Number (0-255), e.g., 128 (analog input value)
  input_state_scaled: undefined,     // Number (0-255), e.g., 200 (scaled analog input)
  prev_input_state: undefined,       // Number (0-255), e.g., 120 (previous analog input)
  prev_input_state_scaled: undefined, // Number (0-255), e.g., 180 (previous scaled value)

  // Binary States:
  input_state_binary: undefined,     // 0 or 1, e.g., 1 (button pressed state)
  prev_input_state_binary: undefined, // 0 or 1, e.g., 0 (previous button state)
  tap_state: undefined,              // 0 or 1, e.g., 1 (tap state active)
  hold_state: undefined,             // 0 or 1, e.g., 0 (hold state inactive)
  plugged_in: undefined,             // 0 or 1, e.g., 1 (device plugged in)

  // Layer and Sticky State:
  layer_state: undefined,            // Bitmask typically as a number (0-255), e.g., 3 (active layers)
  sticky_state: undefined,           // Object mapping usage (string/number) to a value (0-255), e.g., { "0x00120034": 1 }

  // Port:
  port: undefined,                   // Number representing port id, e.g., 0 (default port)

  // Time:
  time: undefined,                   // Timestamp in milliseconds, e.g., Date.now() -> 1660000000000
  time_sec: undefined                // Timestamp in seconds (with ms precision), e.g., 1660000000.123
};

/**
 * Mapping of supported operators to their evaluation functions and operand count.
 * Each operator is defined with the number of operands and a function
 * that receives the evaluated operand values (in order) and returns the result.
 */
const operatorFunctions = {
  // Math Functions
  // 1 operand:
  not: { operands: 1, fn: ([a]) => a === 0 ? 1 : 0 },
  abs: { operands: 1, fn: ([a]) => Math.abs(a) },
  sign: { operands: 1, fn: ([a]) => a > 0 ? 1 : (a < 0 ? -1 : 0) },
  sin: { operands: 1, fn: ([a]) => { const radians = a * Math.PI / 180; return Math.sin(radians); } },
  cos: { operands: 1, fn: ([a]) => { const radians = a * Math.PI / 180; return Math.cos(radians); } },
  round: { operands: 1, fn: ([a]) => Math.round(a) },
  sqrt: { operands: 1, fn: ([x]) => Math.sqrt(x) },
  relu: { operands: 1, fn: ([x]) => x < 0 ? 0 : x },

  // 2 operands:
  add: { operands: 2, fn: ([a, b]) => a + b },
  sub: { operands: 2, fn: ([a, b]) => a - b },
  mul: { operands: 2, fn: ([a, b]) => a * b },
  div: { operands: 2, fn: ([a, b]) => b === 0 ? 0 : a / b },
  mod: { operands: 2, fn: ([a, b]) => { if (b === 0) throw new Error("Evaluation error: modulo by zero"); return a % b; } },
  eq: { operands: 2, fn: ([a, b]) => a === b ? 1 : 0 },
  gt: { operands: 2, fn: ([a, b]) => a > b ? 1 : 0 },
  lt: { operands: 2, fn: ([a, b]) => a < b ? 1 : 0 },
  min: { operands: 2, fn: ([a, b]) => Math.min(a, b) },
  max: { operands: 2, fn: ([a, b]) => Math.max(a, b) },
  atan2: { operands: 2, fn: ([x, y]) => Math.atan2(x, y) },

  // 3 operands:
  ifte: { operands: 3, fn: ([cond, thenVal, elseVal]) => cond !== 0 ? thenVal : elseVal },
  clamp: { operands: 3, fn: ([x, y, z]) => x < y ? y : (x > z ? z : x) },

  // Bitwise Operators
  // 1 operand:
  bitwise_not: { operands: 1, fn: ([x]) => ~x },

  // 2 operands:
  bitwise_or: { operands: 2, fn: ([a, b]) => a | b },
  bitwise_and: { operands: 2, fn: ([a, b]) => a & b },

  // Nonstandard Functions
  // 0 operands:
  time: { operands: 0, fn: () => simulationEnv.time !== undefined ? simulationEnv.time : Date.now() },
  time_sec: { operands: 0, fn: () => simulationEnv.time_sec !== undefined ? simulationEnv.time_sec : Date.now() / 1000 },
  layer_state: { operands: 0, fn: () => simulationEnv.layer_state !== undefined ? simulationEnv.layer_state : Math.floor(Math.random() * 256) },
  plugged_in: { operands: 0, fn: () => { if (simulationEnv.plugged_in !== undefined) return simulationEnv.plugged_in; return simulationEnv.port === 0 ? 1 : 0; }},

  // 1 operand:
  input_state: { operands: 1, fn: ([usage]) => simulationEnv.input_state && simulationEnv.input_state.hasOwnProperty(usage) ? simulationEnv.input_state[usage] : Math.floor(Math.random() * 256) },
  input_state_binary: { operands: 1, fn: ([usage]) => simulationEnv.input_state_binary && simulationEnv.input_state_binary.hasOwnProperty(usage) ? simulationEnv.input_state_binary[usage] : (Math.random() > 0.5 ? 1 : 0) },
  prev_input_state_binary: { operands: 1, fn: ([usage]) => simulationEnv.prev_input_state_binary && simulationEnv.prev_input_state_binary.hasOwnProperty(usage) ? simulationEnv.prev_input_state_binary[usage] : (Math.random() > 0.5 ? 1 : 0) },
  input_state_scaled: { operands: 1, fn: ([usage]) => simulationEnv.input_state_scaled && simulationEnv.input_state_scaled.hasOwnProperty(usage) ? simulationEnv.input_state_scaled[usage] : Math.floor(Math.random() * 256) },
  prev_input_state: { operands: 1, fn: ([usage]) => simulationEnv.prev_input_state && simulationEnv.prev_input_state.hasOwnProperty(usage) ? simulationEnv.prev_input_state[usage] : Math.floor(Math.random() * 256) },
  prev_input_state_scaled: { operands: 1, fn: ([usage]) => simulationEnv.prev_input_state_scaled && simulationEnv.prev_input_state_scaled.hasOwnProperty(usage) ? simulationEnv.prev_input_state_scaled[usage] : Math.floor(Math.random() * 256) },
  sticky_state: { operands: 1, fn: ([usage]) => simulationEnv.sticky_state && simulationEnv.sticky_state.hasOwnProperty(usage) ? simulationEnv.sticky_state[usage] : Math.floor(Math.random() * 256) },
  tap_state: { operands: 1, fn: ([usage]) => simulationEnv.tap_state && simulationEnv.tap_state.hasOwnProperty(usage) ? simulationEnv.tap_state[usage] : (Math.random() > 0.5 ? 1 : 0) },
  hold_state: { operands: 1, fn: ([usage]) => simulationEnv.hold_state && simulationEnv.hold_state.hasOwnProperty(usage) ? simulationEnv.hold_state[usage] : (Math.random() > 0.5 ? 1 : 0) },
  dup: { operands: 1, fn: ([a]) => [a, a] },
  recall: { operands: 1, fn: ([reg]) => reg >= 1 && reg <= 32 && registers[reg] !== undefined ? registers[reg] : 0 },
  port: { operands: 1, fn: ([port]) => { simulationEnv.port = port; return port; } },

  // 2 operands:
  swap: { operands: 2, fn: ([a, b]) => [b, a] },
  monitor: { operands: 2, fn: ([x, usage]) => [] },
  store: { operands: 2, fn: ([x, reg]) => { 
    // Only allow registers 1 through 32.
    if (reg >= 1 && reg <= 32) {
      registers[reg] = x;
    }
    return [];
  } },

  // 3 operands:
  deadzone: { operands: 3, fn: ([x, y, deadzone]) => { 
    let magnitude = Math.sqrt(x * x + y * y); 
    if (magnitude < deadzone) { 
      return ["0", "0"]; 
    } 
    return [x.toString(), y.toString()]; 
  }},

  // 4 operands:
  deadzone2: { operands: 4, fn: ([x, y, inner, outer]) => { 
    let magnitude = Math.sqrt(x * x + y * y); 
    if (magnitude < inner) { 
      return ["0", "0"]; 
    } else if (magnitude > outer) { 
      let scale = outer / magnitude; 
      return [(x * scale).toString(), (y * scale).toString()]; 
    } 
    return [x.toString(), y.toString()]; 
  } },
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
 *
 * This function takes an expression and a debug callback function,
 * then evaluates the expression using the simulateRPN function,
 * providing step-by-step updates via the debug callback.
 *
 * @param {string} expression - The expression to evaluate.
 * @param {Function} debugCallback - A callback function that receives debug information during evaluation.
 * @returns {*} The result returned by simulateRPN after evaluating the expression.
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
try {
  const expr = expression;
  const result = debugEvaluate(expr, {
    callback: (info) => {
      debugStack.push(info)
    }
  });
  console.log("Final Result:", result);
} catch (e) {
  console.error(e.message);
}