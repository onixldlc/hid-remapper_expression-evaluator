function renderEvaluations() {
    // Get the template
    const template = document.getElementById('evaluation_template');
    const container = document.getElementById('evaluation_list');
    let independed_index=1;
    let final_found = false

    // Clear existing evaluations
    container.querySelectorAll('.evaluation_entry').forEach((entry) => entry.remove());

    // if debugStack is empty, hide the evaluation section
    if (debugStack.length === 0) {
        document.getElementById('to_hide_evaluation').hidden = true;
        return
    } else {
        document.getElementById('to_hide_evaluation').hidden = false;
    }

    // Create elements for each debug step
    debugStack.forEach((info, index) => {
        // Clone template
        let humanIndex
        const evaluation = template.cloneNode(true);
        const showLiterals = document.getElementById('show_literal_operations').checked;

        // Check if we should skip literal operations
        if (!showLiterals && info.operation === 'literal') {
            return; // Skip this evaluation step
        }
        
        humanIndex = showLiterals ? index + 1 : independed_index;
        independed_index++;

        // Set unique ID and remove template ID
        evaluation.id = `evaluation_${humanIndex}`;

        // add span to highlight the expression using the start and end index in the info
        // Extract the highlighted expression
        const originalExpr = info.highlightedExpression;
        const highlightedExpr = originalExpr.replace(/\[(.*?)\]/g, (match, group) => {
            return `[<span class="text-yellow-500">${group}</span>]`;
        });
        
        // Replace placeholders
        evaluation.innerHTML = evaluation.innerHTML
            .replace(/INDEX/g, humanIndex)
            .replace('PLAIN_EVALUATION', info.plainEvaluation)
            .replace('EVAL_RESULT', info.result !== null ? info.result : '')
            .replace('OPERATOR', info.operation)
            .replace('XVALUE', info.x !== null ? info.x : 'N/A')
            .replace('YVALUE', info.y !== null ? info.y : 'N/A')
            .replace('ZVALUE', info.z !== null ? info.z : 'N/A')
            .replace('HIGHLIGHTED_EXPRESSION', highlightedExpr);

        // Show the evaluation
        evaluation.hidden = false;

        evaluation.classList.add('evaluation_entry')
            
        // Add event listener for detail toggle
        const checkbox = evaluation.querySelector(`#extra-info-${humanIndex}`);
        const detailsDiv = evaluation.querySelector(`#hide_detail_${humanIndex}`);
        const verticalBar = evaluation.querySelector(`#vertical-extra-info-${humanIndex}`);
        
        if (checkbox && detailsDiv) {
            checkbox.addEventListener('change', (e) => {
                detailsDiv.style.maxHeight = e.target.checked ? '500px' : '0px';
                verticalBar.classList.toggle('rotate-90', !e.target.checked);
            });
        }

        // operator is final then remove the arrow and the right side value
        if(info.operation === 'final'){
            evaluation.querySelector('.evaluation_arrow').remove();
            evaluation.querySelector('.evaluation_result').remove();
            final_found = true;
        }
            
        // If operator store then the right side should be the register name i.e. R1, R2, etc, and the left side should be the value of the register
        if(info.operation === 'store'){
            evaluation.querySelector('.evaluation_text').textContent = info.x;
            evaluation.querySelector('.evaluation_result').textContent = `R${info.y}`;
        }

        // If operator recall then the left side should be the register name i.e. R1, R2, etc 
        if(info.operation === 'recall'){
            evaluation.querySelector('.evaluation_text').textContent = `R${info.x}`;
        }

        
        // Append to container
        container.appendChild(evaluation);
    });

    // if final_found is false then print the rest of the evaluations as the final result
    if(!final_found){
        const evaluation = template.cloneNode(true);
        const showLiterals = document.getElementById('show_literal_operations').checked;
        evaluation.id = `evaluation_${independed_index}`;

        // replace the index with the human readable index
        evaluation.innerHTML = evaluation.innerHTML
            .replace(/INDEX/g, independed_index)
            .replace('PLAIN_EVALUATION', debugStack[debugStack.length-1].fullExpression)

        // Add null checks before removing elements
        const hideDetail = evaluation.querySelector(`#hide_detail_${independed_index}`);
        if (hideDetail) {
            hideDetail.remove();
        }

        const arrow = evaluation.querySelector('.evaluation_arrow');
        if (arrow) {
            arrow.remove();
        }

        const result = evaluation.querySelector('.evaluation_result');
        if (result) {
            result.remove();
        }

        evaluation.hidden = false;
        
        container.appendChild(evaluation);
    }
}