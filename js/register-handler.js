(function() {
    function init_register() {
        const template = document.getElementById("register_template");
        const container = template.parentElement;
        
        // Store input references
        window.registerElements = {};
        
        for (let i = 1; i <= 32; i++) {
            const newRegister = template.cloneNode(true);
            newRegister.hidden = false;
            
            const label = newRegister.querySelector("label");
            const input = newRegister.querySelector("input");
            
            label.textContent = `R${i}:`;
            input.name = `R${i}`;
            input.placeholder = `R${i}`;
            
            // Store reference and set initial value
            window.registerElements[i] = input;
            input.value = registers[i] || 0;

            // Watch for user input
            input.addEventListener("input", function(e) {
                registers[i] = parseInt(e.target.value) || 0;
            });

            // Watch for programmatic changes to registers
            const originalStore = operatorFunctions.store.fn;
            operatorFunctions.store.fn = ([x, reg]) => {
                const result = originalStore([x, reg]);
                if (window.registerElements[reg]) {
                    window.registerElements[reg].value = x;
                }
                return result;
            };

            container.appendChild(newRegister);
        }
    }
    init_register()
})();