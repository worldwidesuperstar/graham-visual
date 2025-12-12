declare const Plotly: any;

// P1 - P10 ids
interface Point {
    x: number;
    y: number;
    id: number;
}

// Data needed for graham logic
interface AlgorithmState {
    stack: Point[];        // Hull edges currently being built
    candidate: Point | null; // Point currently considered
    sortedPoints: Point[];   // Points sorted by x coordinate
    description: string;     // Status text
    isLeftTurn: boolean | null; // Coloring check line
    finished: boolean;
}

let rawPoints: Point[] = [];
let history: AlgorithmState[] = [];
let currentStepIndex = 0;

// Elems
const pointsInput = document.getElementById('pointsInput') as HTMLTextAreaElement;
const btnRandom = document.getElementById('btnRandom') as HTMLButtonElement;
const btnStart = document.getElementById('btnStart') as HTMLButtonElement;
const btnPrev = document.getElementById('btnPrev') as HTMLButtonElement;
const btnNext = document.getElementById('btnNext') as HTMLButtonElement;
const statusMessage = document.getElementById('statusMessage') as HTMLDivElement;
const stackContent = document.getElementById('stackContent') as HTMLDivElement;
const stepCounter = document.getElementById('stepCounter') as HTMLSpanElement;

// 3 point cross product to check if turn is left or right
function crossProduct(o: Point, a: Point, b: Point): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// Parse input from textbox
function parseInput(): Point[] {
    const text = pointsInput.value.trim();
    const parts = text.split(/[;\n]+/);
    const points: Point[] = [];
    let idCounter = 0;

    // Default format: 2,2; 4,8; 5,5;
    parts.forEach(pStr => {
        const [xStr, yStr] = pStr.split(',');
        if (xStr && yStr) {
            const x = parseFloat(xStr.trim());
            const y = parseFloat(yStr.trim());
            if (!isNaN(x) && !isNaN(y)) {
                points.push({ x, y, id: idCounter++ });
            }
        }
    });
    return points;
}

// Graham scan logic
function generateGrahamScanHistory(points: Point[]): AlgorithmState[] {
    const steps: AlgorithmState[] = [];
    if (points.length < 3) return steps;

    // Sort by x-coordinate
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    
    // Show sorted state
    steps.push({
        stack: [],
        candidate: null,
        sortedPoints: sorted,
        description: "Preprocessing: points sorted by X-coordinate.",
        isLeftTurn: null,
        finished: false
    });

    // Stacks are lists of points
    const lowerStack: Point[] = [];
    const upperStack: Point[] = [];

    // Helper to process a list of points and build each half hull
    const buildHull = (pointList: Point[], stack: Point[], hullName: string) => {
        // Process points in x coordinate order
        for (let i = 0; i < pointList.length; i++) {
            const candidate = pointList[i];

            // New candidate
            steps.push({
                stack: [...lowerStack, ...upperStack],
                candidate: candidate,
                sortedPoints: sorted,
                description: `Building ${hullName}: Considering P${candidate.id}...`,
                isLeftTurn: null,
                finished: false
            });

            // While we don't have a left turn pop from stack
            while (stack.length >= 2) {
                const top = stack[stack.length - 1];
                const nextToTop = stack[stack.length - 2];
                
                // Check for left hand turn
                const cp = crossProduct(nextToTop, top, candidate);
                const isLeft = cp > 0;

                // Check the turn
                steps.push({
                    stack: [...lowerStack, ...upperStack],
                    candidate: candidate,
                    sortedPoints: sorted,
                    description: `Checking turn ${nextToTop.id}->${top.id}->${candidate.id}. ${isLeft ? "Left turn (keep)" : "Right turn (pop)"}`,
                    isLeftTurn: isLeft,
                    finished: false
                });

                // Pop if not left turn
                if (!isLeft) {
                    stack.pop();
                    steps.push({
                        stack: [...lowerStack, ...upperStack],
                        candidate: candidate,
                        sortedPoints: sorted,
                        description: `Popped P${top.id} from ${hullName}. Backtracking...`,
                        isLeftTurn: null,
                        finished: false
                    });
                } else {
                    break;
                }
            }
            stack.push(candidate);
            
            // Push to hull if left
            steps.push({
                stack: [...lowerStack, ...upperStack],
                candidate: null,
                sortedPoints: sorted,
                description: `Pushed P${candidate.id} to ${hullName}.`,
                isLeftTurn: null,
                finished: false
            });
        }
    };

    // Build lower hull
    buildHull(sorted, lowerStack, "Lower Hull");

    // Build upper hull after lower hull, reverse the sorted points to go R->L
    const reversedPoints = [...sorted].reverse();
    buildHull(reversedPoints, upperStack, "Upper Hull");

    // Merge hulls
    const finalLower = [...lowerStack];
    const finalUpper = [...upperStack];
    
    if (finalLower.length > 0 && finalUpper.length > 0) {
        finalLower.pop(); 
        finalUpper.pop();
    }
    
    const finalHull = [...finalLower, ...finalUpper, finalLower[0]];

    steps.push({
        stack: finalHull, 
        candidate: null,
        sortedPoints: sorted,
        description: "Done! Upper and lower hulls merged.",
        isLeftTurn: null,
        finished: true
    });

    return steps;
}

// Called each time "next" is clicked, plotly rendering logic
function renderStep() {
    if (history.length === 0) return;
    const state = history[currentStepIndex];

    // Draw all points
    const allPointsTrace = {
        x: state.sortedPoints.map(p => p.x),
        y: state.sortedPoints.map(p => p.y),
        mode: 'markers+text',
        type: 'scatter',
        name: 'Points',
        text: state.sortedPoints.map(p => `P${p.id}`),
        textposition: 'top center',
        marker: { size: 10 }
    };

    // Draw hull edges
    const stackTrace = {
        x: state.stack.map(p => p.x),
        y: state.stack.map(p => p.y),
        mode: 'lines+markers',
        type: 'scatter',
        name: 'Hull',
        line: { width: 3 },
        marker: { size: 12 }
    };

    // Draw checking line
    let checkTrace = { x: [], y: [], mode: 'lines', line: { width: 0 } };
    
    if (state.candidate && state.stack.length > 0) {
        const top = state.stack[state.stack.length - 1];
        
        let checkLineColor = 'orange';

        // Orange (considering), Green (left), Red (right)
        if (state.isLeftTurn === true) {
            checkLineColor = 'green';
        } else if (state.isLeftTurn === false) {
            checkLineColor = 'red';
        }

        checkTrace = {
            x: [top.x, state.candidate.x],
            y: [top.y, state.candidate.y],
            mode: 'lines',
            type: 'scatter',
            name: 'Check',
            line: { width: 3, dash: 'dot', color: checkLineColor }
        } as any;
    }

    // Default layout for the chart
    const layout = {
        xaxis: { title: 'X', zeroline: false },
        yaxis: { title: 'Y', zeroline: false },
        showlegend: false,
        margin: { t: 20, r: 20, b: 40, l: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
    };

    // Update steps and status message
    Plotly.react('graph', [allPointsTrace, stackTrace, checkTrace], layout);
    statusMessage.textContent = state.description;
    stepCounter.textContent = `Step ${currentStepIndex + 1} of ${history.length}`;
    
    // Display stack contents on the side
    const stackPoints = state.stack.map(p => `P${p.id}`).join(', ');
    stackContent.textContent = `(Top) ${stackPoints}`;

    // Disable buttons if on first or last step
    btnPrev.disabled = currentStepIndex === 0;
    btnNext.disabled = currentStepIndex === history.length - 1;
}

// Checks for colinear points (duplicate x or y values in the points list)
function hasDuplicateCoords(points: {x: number, y: number}[]): boolean {
    const xs = new Set(points.map(p => p.x));
    const ys = new Set(points.map(p => p.y));
    return xs.size !== points.length || ys.size !== points.length;
}

// Generate 10 random points, will randomize until not colinear
btnRandom.addEventListener('click', () => {
    let valid = false;
    let pointsData: {x: number, y: number}[] = [];
    
    while (!valid) {
        pointsData = [];
        for(let i=0; i<10; i++) {
            const x = Math.floor(Math.random() * 20);
            const y = Math.floor(Math.random() * 20);
            pointsData.push({x, y});
        }
        if (!hasDuplicateCoords(pointsData)) {
            valid = true;
        }
    }
    
    pointsInput.value = pointsData.map(p => `${p.x},${p.y}`).join('; ');
});

// Check if points parsed from textbox are valid (not colinear or <2 pts)
btnStart.addEventListener('click', () => {
    rawPoints = parseInput();
    
    if (rawPoints.length < 2) {
        alert("Please input at least 2 points.");
        return;
    }

    if (hasDuplicateCoords(rawPoints)) {
        alert("Some of your points are colinear, please input different x and y values for each point");
        return;
    }

    history = generateGrahamScanHistory(rawPoints);
    currentStepIndex = 0;
    renderStep();
});

// Render next step
btnNext.addEventListener('click', () => {
    if (currentStepIndex < history.length - 1) {
        currentStepIndex++;
        renderStep();
    }
});

// Render prev step, go back one
btnPrev.addEventListener('click', () => {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        renderStep();
    }
});

// Init plot
Plotly.newPlot('graph', [], { 
    xaxis: { range: [0, 20] }, 
    yaxis: { range: [0, 20] },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
});