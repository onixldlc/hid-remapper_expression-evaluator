(function() {
    let expresion_input_element = document.getElementById('expression_input');

    expresion_input_element.addEventListener('cut', () => {
        setTimeout(() => {
            console.log('cut');
            expresion_input_element.dispatchEvent(new Event('input'));
        }, 0);
    });

    expresion_input_element.addEventListener('paste', () => {
        setTimeout(() => {
            console.log('paste');
            expresion_input_element.dispatchEvent(new Event('input'));
        }, 0);
    });

    expresion_input_element.addEventListener('input', function() {
        expression = expresion_input_element.value;
        try{
            window.hexeses = {};
            document.querySelectorAll('#configs > .configurations').forEach(node => node.remove());

            console.log(expression)
            if(expression !== ""){
                window.hexeses = processHexadecimals(expression);
            }

            if(!isEmptyObject(window.hexeses)){
                document.getElementById('to_hide_config').hidden = false;
                for (const hex in window.hexeses) {
                    let config = window.hexeses[hex];
                    let template = document.getElementById('configuration_template');
                    let clone = template.cloneNode(true);
                    clone.removeAttribute("id");
                    clone.classList.add("configurations")
                    clone.hidden = false;
                    clone.innerHTML = clone.innerHTML.replace(/0x000000001/g, hex);
                    clone.querySelectorAll('input').forEach(input => {
                        input.addEventListener('input', () => {
                            const propName = input.id.replace(hex + '_', '');
                            if (input.type === 'checkbox') {
                                window.hexeses[hex][propName] = input.checked;
                            } else {
                                window.hexeses[hex][propName] = input.value;
                            }
                            console.log(`Updated ${hex}[${propName}] to`, window.hexeses[hex][propName]);
                        });
                    });
                    document.getElementById('configs').appendChild(clone);
                }
            }else{
                document.getElementById('to_hide_config').hidden = true;
            }

        }catch(e){
            console.log(e);
        }
    });
})();