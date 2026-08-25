/*--------------------------------------------------------------------------------------------------
  File: preload.js
  Description: 
  - This file acts as a secure bridge between Electron's main process (`main.js`) 
    and the front-end renderer (`visualizer.html`).
--------------------------------------------------------------------------------------------------*/
// Import the `contextBridge` and `ipcRenderer` modules from Electron.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
/*--------------------------------------------------------------------------------------------------
    Function: onGraphLayer
    Purpose: Listens for graph updates from `main.js` and sends them to `visualizer.html`
    Usage: Called when new nodes and edges are added to the visualization.
--------------------------------------------------------------------------------------------------*/
    onGraphLayer: (callback) => ipcRenderer.on('graph-layer', (event, data) => callback(data)),

/*--------------------------------------------------------------------------------------------------
    Function: onPaintNode
    Purpose: Listens for requests to change the color of a specific node.
    Usage: Used to highlight important nodes like the most central node.
--------------------------------------------------------------------------------------------------*/
    onPaintNode: (callback) => ipcRenderer.on('paint-node', (event, data) => callback(data)),

/*--------------------------------------------------------------------------------------------------
    Function: onPaintPath
    Purpose: Listens for requests to color an entire path (nodes & edges).
    Usage: Used for both longest paths (`-g`) and shortest paths (`-p`).
--------------------------------------------------------------------------------------------------*/
    onPaintPath: (callback) => ipcRenderer.on('paint-path', (event, data) => callback(data)),

/*--------------------------------------------------------------------------------------------------
    Function: onSetMode
    Purpose: Switches the legend display between "Graph Mode" (`-g`) and "Shortest Path Mode" (`-p`).
    Usage: Controls the visibility of the legend keys for longest vs. shortest path.
--------------------------------------------------------------------------------------------------*/
    onSetMode: (callback) => ipcRenderer.on('set-mode', (event, data) => callback(data)),
});

