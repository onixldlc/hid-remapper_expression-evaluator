function evaluateExpression(expr, context = {}) {
    // context can supply functions to simulate fetching state, registers, etc.
    // For now, we use context.inputState and context.registers as optional helpers.
    const tokens = expr.trim().split(/\s+/);
    const stack = [];
    const registers = context.registers || new Array(33).fill(0); // registers[1..32]
  
    // Helper: Pop n values from the stack, error if not enough
    function pop(n = 1) {
      if (stack.length < n) {
        throw new Error("Evaluation error: insufficient values on stack");
      }
      return n === 1 ? stack.pop() : stack.splice(-n, n);
    }
  
    // Operation implementations
    const ops = {
      // Arithmetic operations
      "add": () => {
        const [b, a] = pop(2);
        stack.push(a + b);
      },
      "sub": () => {
        const [b, a] = pop(2);
        stack.push(a - b);
      },
      "mul": () => {
        const [b, a] = pop(2);
        stack.push(a * b);
      },
      "div": () => {
        const [b, a] = pop(2);
        if (b === 0) {
          stack.push(0);
        } else {
          stack.push(a / b);
        }
      },
      "mod": () => {
        const [b, a] = pop(2);
        if (b === 0) {
          throw new Error("Evaluation error: modulo by zero");
        }
        stack.push(a % b);
      },
      "eq": () => {
        const [b, a] = pop(2);
        stack.push(a === b ? 1 : 0);
      },
      "gt": () => {
        const [b, a] = pop(2);
        stack.push(a > b ? 1 : 0);
      },
      "lt": () => {
        const [b, a] = pop(2);
        stack.push(a < b ? 1 : 0);
      },
      "min": () => {
        const [b, a] = pop(2);
        stack.push(a < b ? a : b);
      },
      "max": () => {
        const [b, a] = pop(2);
        stack.push(a > b ? a : b);
      },
      "not": () => {
        const a = pop();
        stack.push(a === 0 ? 1 : 0);
      },
      "ifte": () => {
        const [z, y, x] = pop(3);
        stack.push(x !== 0 ? y : z);
      },
      "abs": () => {
        const a = pop();
        stack.push(Math.abs(a));
      },
      "sign": () => {
        const a = pop();
        stack.push(a > 0 ? 1 : (a < 0 ? -1 : 0));
      },
      "sin": () => {
        // expecting x in degrees
        const a = pop();
        const radians = a * (Math.PI / 180);
        stack.push(Math.sin(radians));
      },
      "cos": () => {
        const a = pop();
        const radians = a * (Math.PI / 180);
        stack.push(Math.cos(radians));
      },
      "round": () => {
        const a = pop();
        stack.push(Math.round(a));
      },
      // Stack operations
      "dup": () => {
        const a = pop();
        stack.push(a, a);
      },
      "swap": () => {
        const [b, a] = pop(2);
        stack.push(b, a);
      },
      // Bitwise operations
      "bitwise_or": () => {
        const [b, a] = pop(2);
        stack.push(a | b);
      },
      "bitwise_and": () => {
        const [b, a] = pop(2);
        stack.push(a & b);
      },
      "bitwise_not": () => {
        const a = pop();
        stack.push(~a);
      },
      // Register operations: 'store' takes (x, n); 'recall' takes (n)
      "store": () => {
        const [n, x] = pop(2);
        if (n < 1 || n > 32) {
          throw new Error("Evaluation error: register number out of range");
        }
        registers[n] = x;
      },
      "recall": () => {
        const n = pop();
        if (n < 1 || n > 32) {
          throw new Error("Evaluation error: register number out of range");
        }
        stack.push(registers[n]);
      },
      // For demonstration, a simple version of input_state.
      // In a realistic scenario, context.inputState should be provided.
      "input_state": () => {
        const usage = pop();
        if (context.inputState && typeof context.inputState === 'function') {
          stack.push(context.inputState(usage));
        } else {
          throw new Error("Evaluation error: input_state not implemented");
        }
      },
      "input_state_binary": () => {
        const usage = pop();
        if (context.inputStateBinary && typeof context.inputStateBinary === 'function') {
          stack.push(context.inputStateBinary(usage));
        } else {
          throw new Error("Evaluation error: input_state_binary not implemented");
        }
      },
      "time": () => {
        // gets current time in milliseconds
        stack.push(Date.now());
      },
      "time_sec": () => {
        stack.push(Date.now() / 1000);
      }
    };
  
    // Process each token
    for (let token of tokens) {
      // If the token is a block comment, skip (we assume /* ... */ in one token is not supported)
      if (token.startsWith("/*")) {
        continue;
      }
      // Check if token is a number: integer or float
      if (/^-?\d+(\.\d+)?$/.test(token)) {
        stack.push(parseFloat(token));
      } else if (/^0x[0-9a-fA-F]+$/.test(token)) {
        // Hex numbers
        stack.push(parseInt(token, 16));
      } else if (ops[token] !== undefined) {
        ops[token]();
      } else {
        throw new Error("Evaluation error: unknown token '" + token + "'");
      }
    }
  
    if (stack.length !== 1) {
      throw new Error("Evaluation error: stack has " + stack.length + " items after evaluation. Expected exactly one result.");
    }
    return stack[0];
  }
  
  // Example usage:
  try {
    // Define a test expression (example: "2 3 add")
    const expr = "2 3 add";
    const result = evaluateExpression(expr, {
      // For demonstration, no actual input state functions are provided.
      inputState: (usage) => {
        // Simulate by returning a constant value based on usage
        return 128; 
      },
      inputStateBinary: (usage) => {
        return 1;
      }
    });
    console.log("Expression result:", result);
  } catch (error) {
    console.error(error.message);
  }