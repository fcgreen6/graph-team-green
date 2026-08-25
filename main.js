//--------------------------------------------------------------------------------------------------
// graph-team-green: main.js
// Authors: Joyce Tang and Fletcher Green
// Purpose: Practice using third party libraries, apply knowlege of graphs to real world problems,
// and develop problem solving skills.
//--------------------------------------------------------------------------------------------------

// Graph library requirements.
const graphLibrary = require("graphlib");
const graphDataType = graphLibrary.Graph;
const graphAlgorithms = graphLibrary.alg;

// File reader requirements.
const fileSystem = require("fs");
const readLine = require("readline");

// Electron requirements (for opening a window directly).
const { app, BrowserWindow, ipcMain } = require('electron');

// Global window reference.
let win = null;

async function main() {

    // Get command line parameters.
    const clParams = process.argv.slice(2);

    if (clParams.length != 4) {
        console.error("Error: Invalid number of parameters.");
        process.exit(1);
    }

    const filePath = clParams[0]; // Path to graph file.
    const opFlag = clParams[1]; // -p or -g flag.
    const opNum1 = clParams[2]; // First number specified
    const opNum2 = clParams[3]; // Second number specified.

    // Create graph data structure.
    const webGraph = new graphDataType({ directed: true });

    if (opFlag == "-g") {

        // Open the Electron visualization window.
        await CreateVisualizationWindow('graph');
        
        try {
            
            // Creates and displays the graph.
            await CreateSubGraph(webGraph, filePath, opNum1, Number(opNum2));

            // Make names for csv output files
            const csvName1 = "apsp/apsp-" + opNum1 + "-" + opNum2 + ".csv";
            const csvName2 = "closeness/closeness-" + opNum1 + "-" + opNum2 + ".csv";

            // Using graph library, find APSP.
            let allPairsJSON = graphAlgorithms.floydWarshall(webGraph);

            // Convert APSP to a CSV file. Find the start and end of the longest shortest path.
            let longestStartEnd = await ProcessApspJson(csvName1, allPairsJSON);
            console.log(`APSP File Path: ./${csvName1}`);

            // Find the most central vertex.
            let mostCentral = await CalculateCentrality(csvName1, csvName2);
            console.log(`Closeness Centrality File Path: ./${csvName2}\n`);
            
            // Paint the most central vertex and output the identifier.
            PaintNode(mostCentral);
            console.log(`Most Central Vertex: ${mostCentral}`);

            // If there are more than 90 edges, finding the actual longest path is too expensive. So, instead the
            // longest of the shortest paths is displayed.
            let longestPath = [];
            if (webGraph.edges().length <= 90) {
            
                // Find the actual longest path.
                longestPath = FindLongestPath(webGraph);
                console.log("Longest Path Type: Actual Longest Path");
            } else {

                // Find the longest of the shortest paths.
                longestPath = GenerateShortestPath(webGraph, longestStartEnd.source, longestStartEnd.destination);
                console.log("Longest Path Type: Longest Shortest Path");
            }

            // Paint the longest path and then repaint the most central node.
            PaintPath(longestPath);
            PaintNode(mostCentral);
            console.log(`Longest Path Value: ${longestPath.length - 1}`);
            console.log(`Longest Path Sequence: ${longestPath}\n`);

            console.log("Finished processing graph. Close the window to exit the program.")
        } catch (error) {
        
            // Catch for errors which occur within the subgraph flag.
            console.error("Subgraph error: ", error);
            process.exit(1);
        }
    } else if (opFlag == "-p") {

        try {
            
            // Find the value of the shortest path from the first vertex specified to the second.
            let pathValue = await MakeShortestPathGraph(webGraph, filePath, opNum1, opNum2);

            // Display the shortest path if it is efficient to do so.
            if (pathValue != "Infinity") {
                
                // Generate the shortest path.
                let pathSequence = GenerateShortestPath(webGraph, opNum1, opNum2);

                // Output the shortest path.
                console.log(`Shortest Path Value: ${pathValue}`);
                console.log(`Shortest Path Sequence: ${pathSequence}`, "\n");

                // Display the graph if there are less than 100 nodes.
                // If there are over 100 nodes, do not display the graph as it is not required and could possibly be expensive.
                if (webGraph.nodes().length <= 100) {
                    
                    // Open the Electron visualization window and display the graph.
                    await CreateVisualizationWindow('shortest-path');
                    await DisplaySubGraph(webGraph.nodes(), webGraph.edges());
                    PaintPath(pathSequence);

                    console.log("Finished creating the graph. Close the window to exit the program.")
                } else {

                    // Exit the program.
                    console.log("Program exited.")
                    process.exit(0);
                }
            } else {

                // Output infinite path length.
                console.log("Shortest Path Value: Infinity\n");

                // Exit the program.
                console.log("Program Exited.")
                process.exit(0);
            }
        } catch (error) {
        
            // Catch for errors which occur within shortest path flag.
            console.error("Shortest path error: ", error);
            process.exit(1);
        }
    } else {

        // Error if the user provides an invalid flag.
        console.error("Error: Invalid operation flag.");
        process.exit(1);
    }
}

//--------------------------------------------------------------------------------------------------
// Graph Display Functions
//--------------------------------------------------------------------------------------------------

// createVisualizationWindow Function:
// Purpose: Create a window to display the graph within.
// Parameters:
// - mode: Mode identifier specifying the type of graph to display. ('graph' for general subgraph, 'shortest-path for
//   a shortest-path graph).
// Return:
// - promise: A promise that resolves when the window is finished loading.
async function CreateVisualizationWindow(mode) { // Pass mode to visualizer.
    // Create a new window.
    return new Promise(resolve => {
        app.whenReady().then(() => {
            win = new BrowserWindow({
                width: 1000,
                height: 800,
                webPreferences: {
                    preload: __dirname + '/preload.js',
                    contextIsolation: true,
                    enableRemoteModule: false,
                    nodeIntegration: false
                }
            });
            // Load the visualizer.
            win.loadFile('visualizer.html');
            win.webContents.once('did-finish-load', () => {
                win.webContents.send('set-mode', mode); // Send mode to visualizer.
                resolve();
            });
        });
        // Close the app when all windows are closed.
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    });
}

// DisplaySubGraph Function:
// Purpose: Send a set of vertices and edges to the front end. These vertices and edges will be added to the graph display.
// Parameters:
// - vertices: Array of vertices to add. Each element is a string which represents a number.
// - edges: Array of edges to add. Format: [{v: 'sourceNum', w: 'destNum'}, {v: 'sourceNum', w: 'destNum'}, ...].
async function DisplaySubGraph(vertices, edges) {
    
    win.webContents.send('graph-layer', { newNodes: vertices, newEdges: edges });
}

// PaintNode Function:
// Purpose: Send the front end a single vertex to be painted a unique color.
// - nodeId: The vertex to paint.
// - color: Color to paint the vertex.
function PaintNode(nodeId, color='#BF0A30'){

    win.webContents.send('paint-node', { nodeId, color });
}

// PaintPath Function:
// Purpose: Send the front end a sequence of vertices to be connected by a colored path.
// - path: The sequence of vertices to paint.
// - color: Color to paint the path.
function PaintPath(path, color='#0292C2'){
    win.webContents.send('paint-path', { path, color });
}

//--------------------------------------------------------------------------------------------------
// Graph Data Structure Functions
//--------------------------------------------------------------------------------------------------

// MakeShortestPathGraph Function:
// Purpose: Using the file specified, generate a graph layer by layer starting at startNode. When endNode is
// identified, stop building the graph.
// Parameters:
// - webGraph: An empty graph.
// - filePath: Path to file containing graph vertices and edges.
// - startNode: The vertex to start searching from.
// - endNode: The vertex to search for.
// Return:
// - shortestPath: The numeric value of the shortest path in the graph. Equal to the depth of the graph.
async function MakeShortestPathGraph(webGraph, filePath, startNode, endNode) {

    let currVertices = new Set([startNode]); // The vertices to be processsed on each layer.
    let processedVertices = new Set(); // A set of all vertices in the graph.

    let shortestPath = 0; // The length of the shortest path.

    if (startNode != endNode) { 
                
        shortestPath += 1;
                
        // Create the subgraph layer by layer until the destination node is found.
        // The number of layers created is the value of the shortest path.
        while (currVertices.size > 0) {

            await CreateSubGraphLayer(webGraph, filePath, currVertices);

            const allVertices = new Set(webGraph.nodes()); // Make a set with all vertices of the graph.
            
            if (allVertices.has(endNode)) {

                break;
            }

            // Find the next layer of vertices to be processed.
            processedVertices = new Set([...processedVertices, ...currVertices]);
            currVertices = SetDifference(allVertices, processedVertices);
            shortestPath += 1;
        }
    }

    // If no more nodes could be processed, the endNode is unreachable.
    if (currVertices.size == 0) {

        shortestPath = "Infinity";
    }

    return shortestPath;
}

// GenerateShortestPath Function:
// Purpose: Given a shortest path graph, find the sequence of the shortest path.
// Parameters:
// - webGraph: A graph that contains the source and destination vertices. The destination vertex must be reachable
//   from the source vertex.
// - sourceNode: First vertex in the path.
// - destinationNode: Last vertex in the path.
// Return:
// - Shortest Path: The shortest path from the starting vertex to ending vertex contained within an array.
function GenerateShortestPath(webGraph, sourceNode, destNode) {

    // Run Dijksrta to find all shortest paths from the source vertex.
    let shortestPaths = graphAlgorithms.dijkstra(webGraph, sourceNode);

    // Starting at the destination vertex, follow predecessors until the source is reached.
    let retPath = [destNode];
    while (retPath[retPath.length - 1] != sourceNode) {

        retPath.push(shortestPaths[retPath[retPath.length - 1]].predecessor);
    }

    // Since the destination is at the start of the array, reverse it.
    return retPath.reverse();
}

// CreateSubGraph Function:
// Purpose: Create a graph layer by layer until depth is reached using the specified file. Send the front end
// one layer of the graph at a time to somewhat animate the process.
// Parameters:
// - webGraph: An empty graph.
// - filePath: Path to file containing graph vertices and edges.
// - startNode: The vertex to start searching from.
// - graphDepth: The number of iterations used to generate layers of the graph.
async function CreateSubGraph(webGraph, filePath, startNode, graphDepth) {

    // Sets used to build the graph. 
    let currVertices = new Set([startNode]);
    let processedVertices = new Set();
    let currEdges = [];

    // Display graph using the most recently added vertices and edges.
    await DisplaySubGraph([startNode], []);

    for (let i = 0; i < graphDepth; i++) {

        // Generate a layer of the graph.
        await CreateSubGraphLayer(webGraph, filePath, currVertices);
        
        // Get the edges that were added onto the graph.
        currEdges = GetOutgoingEdges(webGraph, currVertices);
        
        // Get the next layer of vertices to be processed.
        processedVertices = new Set([...processedVertices, ...currVertices]);
        const allVertices = new Set(webGraph.nodes());
        currVertices = SetDifference(allVertices, processedVertices);
      
        // Display graph using the most recently added vertices and edges.
        await DisplaySubGraph(Array.from(currVertices), currEdges);
      
        // Break out of the loop if there are no more vertices to process.
        if (currVertices.size == 0) {
          
          break;
        }
    }
}

// CreateSubGraphLayer Function:
// Purpose: Read the specified file, skipping lines that start with a hashtag. Each line within the file represents a 
// directed edge starting at the first number of the line. There are two numbers are separated by a tab on each line.
// If an edge within the file starts with a vertex on the current layer, add it to the graph. 
// Parameters:
// - webGraph: Graph to add edges to.
// - filePath: Path to file containing graph vertices and edges.
// - currVertices: The vertices on the layer of the graph currently being processed.
// Return:
// - Promise: A promise that resolves once the file has been read. Rejects if the file specified is invalid.
async function CreateSubGraphLayer(webGraph, filePath, currVertices) {

    return new Promise((resolve, reject) => {
        
        // Open file.
        const fileStream = fileSystem.createReadStream(filePath);
        const readStream = readLine.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        readStream.on("line", (currLine) => {
            
            // Skip lines that start with hashtag.
            if (!currLine.startsWith("#")) {
                
                // Get the two numbers on the line.
                let [numOne, numTwo] = currLine.split("\t");

                // Check if the edge belongs to the vertices being processed.
                if (currVertices.has(numOne)) {
                    
                    webGraph.setEdge(numOne, numTwo);
                }
            }
        });

        // Resolve when finished reading.
        readStream.on("close", () => {

            resolve();
        });

        // Reject if there is an error.
        readStream.on("error", reject);
    });
}

// ProcessApspJson Function:
// Purpose: Create a csv file for the output of Floyd's algorithm and record the start and end of the longest shortest path
// found.
// Parameters:
// - filePath: Path for writing the file.
// - Json: Json output of graphlib Floyd's algorithm.
// Return:
// - Promise: A promise that resolves into a JS object for longest shortest path. 
//   Format: {source: 'sourceNode', destination: 'destnode'}.
async function ProcessApspJson(filePath, Json) {

    let writeContent = "source, destination, distance";
    let retVal = {};
    let currLongest = -1;

    for (const sourceNode in Json) {

        for (const destinationNode in Json[sourceNode]) {

            writeContent += "\n" + sourceNode + ", " + destinationNode + ", " + Json[sourceNode][destinationNode]["distance"];

            if (Json[sourceNode][destinationNode]["distance"] != "Infinity") {

                if (Number(Json[sourceNode][destinationNode]["distance"]) > currLongest) {

                    currLongest = Number(Json[sourceNode][destinationNode]["distance"]);
                    retVal = {source: sourceNode, destination: destinationNode};
                }
            }
        }
    }

    return new Promise((resolve, reject) => {
    
        fileSystem.writeFile(filePath, writeContent, (error) => {
    
            if (error) {
            
                reject(error);
            }
            resolve(retVal);
        });
    });
}

// CalculateCentrality Function:
// Purpose: Given an APSP csv file, calculate the centrality of each vertex in the graph, returning the most central vertex.
// For vertices with unreachables, centrality is still calculated by ignoring unreachable distances. However, we decided to only
// consider vertices with no unreachables for the most central vertex. (For example, if there is a vertex with only one 
// outgoing edge that points into a vertex with only incoming edges, it will have a misleadingly high centrality value).
// Parameters:
// - inFilePath: File path to APSP csv file used to calculate centrality.
// - outFilePath: Path to write the centrality of each vertex to. The file is ordered smallest to largest vertex.
// Return:
// - Promise which resolves into the most central vertex found.
async function CalculateCentrality(inFilePath, outFilePath) {

    return new Promise((resolve, reject) => {
        
        // Open file.
        const fileStream = fileSystem.createReadStream(inFilePath);
        const readStream = readLine.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let firstIteration = true; // Boolean for skiping the first line of the file.
        let countVertex = true; // Boolean for determining if a vertex is valid.
        let currID = ""; // The ID of the current vertex being processed.
        let currCentrality = 0; // The centrality of the vertex currently being processed.
        let centralityOutput = "vertex, centrality"; // String used to write output.
        let highestCentrality = 0; // The highest centrality found so far.
        let mostCentral = ""; // The most central node found so far.

        readStream.on("line", (currLine) => {
            
            if (firstIteration) {
                
                // Skip the first line of the file.
                firstIteration = false;
                return;
            } else {

                // Assign currID on the first line.
                if (currID === "") {

                    currID = currLine.substring(0, currLine.indexOf(","));
                    mostCentral = currID;
                }

                // Record centrality when the curent vertex changes.
                if (currID !== currLine.substring(0, currLine.indexOf(","))) {

                    // Get the centrality measure.
                    if (currCentrality !== 0) {

                        currCentrality = 1 / currCentrality;
                    }

                    // Write line to output string.
                    centralityOutput += "\n" + currID + ", " + currCentrality;

                    // Find the highest centrality.
                    if ((currCentrality > highestCentrality) && countVertex) {

                        highestCentrality = currCentrality;
                        mostCentral = currID;
                    }

                    currID = currLine.substring(0, currLine.indexOf(","));
                    currCentrality = 0;
                    countVertex = true;
                }

                // For all other vertices in the graph, get the shortest distance.
                let currShortest = Number(currLine.substring(currLine.lastIndexOf(",") + 1));

                // Do not count the vertex as the most central node if it has unreachables.
                // Centrality value is still calculated.
                if (currShortest === "Infinity") {

                    // Mark vertex as an invalid candidate for most central vertex.
                    countVertex = false;
                    return;
                }

                // Acumulate the shortest path values.
                currCentrality += currShortest;
            }
        });

        readStream.on("close", () => {

            resolve(new Promise((resolve, reject) => {

                // Get the centrality measure of the last vertex.
                if (currCentrality !== 0) {

                    currCentrality = 1 / currCentrality;
                }

                // Write line to output string.
                centralityOutput += "\n" + currID + ", " + currCentrality;

                // Check if the last vertex has the highest centrality
                if ((currCentrality > highestCentrality) && countVertex) {

                    mostCentral = currID;
                }
    
                fileSystem.writeFile(outFilePath, centralityOutput, (error) => {
            
                    if (error) {
                    
                        reject(error);
                    }

                    // Resolve into the most central vertex.
                    resolve(mostCentral);
                });
            }));
        });

        readStream.on("error", reject);
    });
}

// FindLongestPath Function:
// Purpose: Finds the longest path in a graph by calling a function that finds the longest path from a single vertex
// for all vertices.
// Parameters:
// - webGraph: The graph to find the longest path for.
// Return:
// - Longest Path Sequence: An array containing the longest path in the graph.
function FindLongestPath(webGraph) {

    let longestStart = "";
    let longestPathValue = 0;

    // Call the GenerateLongestPath function for all vertices in the graph, and save the longest of the longest paths.
    webGraph.nodes().forEach((vertex) => {

        let currLongest = GenerateLongestPath(webGraph, vertex, [vertex]).length;

        if (currLongest > longestPathValue) {

            longestStart = vertex;
            longestPathValue = currLongest;
        }
    });

    return GenerateLongestPath(webGraph, longestStart, [longestStart]);
}

// GenerateLongestPath Function:
// Purpose: Finds the longest path sequence starting from a single vertex.
// Parameters:
// - webGraph: The graph to find the longest path within.
// - vertexID: The vertex to find the longest path out of.
// - vertexStack: Stack of vertices used to hold visited vertices and generate path.
// Return:
// - Longest Path: An array containing the longest path sequence.
function GenerateLongestPath(webGraph, vertexID, vertexStack) {
    
    if (webGraph.outEdges(vertexID)) {
        
        // For each outgoing edge find the length of the path and keep the longest one.
        let longestPathFound = 0
        let longestPathArr = Array.from(vertexStack);
        webGraph.outEdges(vertexID).forEach((edge) => {

            // Check that the vertex has not yet been visited.
            let nextVertex = edge.w;
            if (!ArrayHas(vertexStack, nextVertex)) {

                vertexStack.push(nextVertex);
                let currPathArr = GenerateLongestPath(webGraph, nextVertex, vertexStack);
                vertexStack.pop(nextVertex);

                // If a longer path has been found, save it.
                if (currPathArr.length > longestPathFound) {

                    longestPathFound = currPathArr.length;
                    longestPathArr = currPathArr;
                }
            }
        });

        // If all outgoing edges have been visited, return an array created from the vertex stack.
        return longestPathArr;
    } else {

        // If there are no outgoing edges, return an array created from the vertex stack.
        return Array.from(vertexStack);
    }
}

//--------------------------------------------------------------------------------------------------
// Assorted Helper Functions
//--------------------------------------------------------------------------------------------------

// GetOutgoingEdges Function:
// Purpose: Create an array of all outgoing edges from a set of vertices.
// - webGraph: Graph to get outgoing edges from.
// - vertexSet: Set of vertices to get outgoing edges from.
// Return:
// - Outgoing Edges: An array of all outgoing edges from the set of vertices.
function GetOutgoingEdges(webGraph, vertexSet) {

    let retVal = [];

    // Convert set of vertices into an iterator.
    const setElements = vertexSet.values();
    for (const element of setElements) {

        // Get outgoing edges from each vertex and add them to the end of the return array.
        retVal = retVal.concat(webGraph.outEdges(element));
    }

    return retVal;
}

// SetDifference Function:
// Purpose: Calculate the difference between two sets. (lhs - rhs).
// Parameters:
// - lhs: The set on the left side of the difference operation.
// - rhs: The set on the right side of the difference operation.
// Return:
// - Difference: A set containing elements in lhs that are not in rhs.
function SetDifference(lhs, rhs) {

    // Create a new set with the values from lhs.
    const retVal = new Set([...lhs]);

    // Create an iterator for lhs.
    const lhsElements = lhs.values();
    for (const element of lhsElements) {

        // If the element of lhs is in rhs, remove it from retVal.
        if (rhs.has(element)) {

            retVal.delete(element);
        }
    }

    return retVal;
}

// ArrayHas Function:
// Purpose: Determine if an array has a specific element.
// Parameters:
// - inArr: Array to search for the target.
// - target: Target element within the array.
// Return:
// - Bool: True if the array has the element. False if the array does not have the element.
function ArrayHas(inArr, target) {

    for (let i = 0; i < inArr.length; i++) {

        if (inArr[i] === target) {

            return true;
        }
    }

    return false;
}

// Call main to run the program.
main();