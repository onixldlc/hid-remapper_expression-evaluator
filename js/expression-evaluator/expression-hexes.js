function processHexadecimals(expression) {
    // Extract all hexadecimals using regex
    const hexRegex = /0x[0-9A-Fa-f]+/g;
    const hexNumbers = expression.match(hexRegex);
    const result = {}
    
    // Create an array of objects, one for each hexadecimal
    hexNumbers.forEach(hex => {
        result[hex] = {
            input_state: undefined,                 // Number (0-255), e.g., 128 (analog input value)
            input_state_scaled: undefined,          // Number (0-255), e.g., 200 (scaled analog input)
            prev_input_state: undefined,            // Number (0-255), e.g., 120 (previous analog input)
            prev_input_state_scaled: undefined,     // Number (0-255), e.g., 180 (previous scaled value)

            input_state_binary: undefined,          // 0 or 1, e.g., 1 (button pressed state)
            prev_input_state_binary: undefined,     // 0 or 1, e.g., 0 (previous button state)
            tap_state: undefined,                   // 0 or 1, e.g., 1 (tap state active)
            hold_state: undefined,                  // 0 or 1, e.g., 0 (hold state inactive)
            plugged_in: undefined,                  // 0 or 1, e.g., 1 (device plugged in)

            layer_state: undefined,                 // Bitmask typically as a number (0-255), e.g., 3 (active layers)
            sticky_state: undefined,                // 0 or 1, e.g., 1 (sticky state)
        }
    });
    return result;
}
  
// window.addresses = processHexadecimals(expression);
// console.log(hexObjects);