import * as d3 from 'd3';

// DOM elements
let graphContainer  = d3.select("#graph-container");
let paddingContainer= d3.select('.padding-container');
let htmlBody        = d3.select('body');

// Set the dimensions and margins of the graph
let margin = { top: 10, right: 10, bottom: 10, left: 10};

let w = parseInt(graphContainer.style('width')),
    h = window.innerHeight;

let d3W = w + margin.left + margin.right,
    d3H = h + margin.top + margin.bottom;

let context = createProperResCanvas(w, h);

// W/ Margin convention, set the SVG and G
const svg = graphContainer.append('svg')
                .attr('width', w) // sets the viewport width
                .attr('height', h) // sets the viewport height
              .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

var tooltip = d3.select("body").append("div")
              .attr("class", "tooltip");

let nodeRadius = 20;
let clickedNode = null;

// Colors generated from "I want hue": http://tools.medialab.sciences-po.fr/iwanthue/
const colors = d3.scaleOrdinal(
  ["#5779d0",
  "#b39f3b",
  "#5cb1c5",
  "#7aa364"]);

const colorArr = ["#5779d0",
  "#b39f3b",
  "#5cb1c5",
  "#7aa364"]

d3.csv("/dist/data/particle-paths.csv").then(data => {

  // Setup Simulation
  var simulation = d3.forceSimulation()
    .force("link", 
      d3.forceLink()
        .id(d => d.id)
    )
    .force("charge", 
      d3.forceManyBody()
        .strength(-10000)
      )
    .force("center", d3.forceCenter(w / 2, h / 2))
    .force('x', d3.forceX(w / 2))
    .force('y', d3.forceY(h / 2))
    .on("tick", ticked)
    .stop();

  // ========== Parse Data into JSON-like object ============
  // Get only nodes, sort, then assign to variable
  let nodeNames = Object.values(data[0])
                      .slice(0,-1)
                      .sort();

  let nodeArr = [];
  nodeNames.forEach( node => {
    nodeArr.push( {name: node} );
  });            
  
  // Initialize links array and push all ind's paths
  let pathArrays = [];
  data.forEach(d =>  {
    if (typeof d === 'object'){
      let pathArr = Object.values(d).slice(0,-1);
      pathArrays.push( {
        pathArr,
        source: nodeNames.indexOf(d['1']),
        target: nodeNames.indexOf(d['10'])
      } );
    }
  }); 

  // Bind nodes and links to an object
  let dataset = {nodes: nodeArr, links: pathArrays};

  // Set the link attributes for `line` and particles
  dataset.links.forEach(link => {
    link.transitionRate = 1;
    link.width = link.transitionRate;
  });

  dataset.links.forEach(link => {
    link.freq = link.transitionRate;
    link.particleSize = 5 * link.transitionRate ;
  });

  // Format the nodes and links for visualization
    // To minimize collisions AND overlaps, you can concat both the actual nodes and nodes added onto the links
  simulation.nodes(dataset.nodes);
  simulation.force("link", d3.forceLink(dataset.links));

  // Create a selector for all of the individuals
   // d3.select('#path-selector')
   //  .data(dataset.links)
   //  .enter()
   //  .append('option')
   //  .attr('class', 'path-selector-option')
   //  .attr('id' d => 'ind' + d.name)
  
  //Create links as lines
  var links = svg.selectAll("path")
    .data(dataset.links)
    .enter()
    .append("path")
    .attr('class', 'link')
    .attr('fill', 'none')
    .style("stroke", "#eee")
    .style("stroke-width", 1);
      // (d,i) => i === 1 ? 5 : 1);
      // function(d){ return d.width ? d.width : Math.ceil(nodeRadius/3) });
  
  //Create node groups for circles and text
  var nodeG = svg.selectAll(".node")
    .data(dataset.nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .call(d3.drag()  //Define what to do on drag events
      .on("start", dragStarted)
      .on("drag", dragged)
      .on("end", dragEnded));

  var nodes = nodeG.append("circle")
    .attr("r", nodeRadius)
    .style("fill", colorArr[0])
    // .on('mouseover', fade(0.1))
    // .on('mouseout', fade(1))
    .on('dblclick', function(d) {
      d3.selectAll('circle')
        .style('fill', colorArr[0])

      d3.select(this).style('fill', d => {
        return clickedNode !== d.name  ?
           colorArr[2] :
           colorArr[0]
      });

      if (clickedNode === d.name){
        clickedNode = null;
      } else {
        clickedNode = d.name;  
      }
    
    });

  nodeG.append('text')
    .attr('dx', 0)
    .attr('dy', '.35em')
    // .text('a')
    .text(d => d.name)

  simulation.restart();

  // Functions that access the data
  // ===================== DRAG =====================
  function dragStarted(d) {
    if (!d3.event.active) 
      simulation.alphaTarget(0.3).restart();

    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragEnded(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // ===================== TICKED =====================
  // Every time the simulation "ticks", this will be called
  function ticked() {

    // Translate G so that the circle and text are properly placed
    nodeG.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

    // nodes.attr("cx", function(d) { return d.x = Math.max(nodeRadius, Math.min(w - nodeRadius, d.x)); })
    //      .attr("cy", function(d) { return d.y = Math.max(nodeRadius, Math.min(h - nodeRadius, d.y)); });

    links.attr('d', (d,i) => {
        let sx = d.source.x;
        let sy = d.source.y;
        let dpa= d.pathArr;

        // Intilialize the pathString with the starting position
        let pathString = `M ${sx},${sy}`;
             
        for (let j = 1; j < dpa.length; j++){
          let nextId = nodeNames.indexOf(dpa[j]); 
          let nextNode = nodeArr[nextId];

          pathString += ` L ${nextNode.x},${nextNode.y}`;
        }
       
        return pathString;
    });
  };

  // Hover states for nodes and links
  // ========= 
  // The following variables and functions are based on Micah Stubb's code, which is based on James Curley's code
  // SOURCE: http://bl.ocks.org/micahstubbs/d2362886844cff427e797ff992cc23ec
  // Source's Source: http://bl.ocks.org/jalapic/14fcf6f266e877cb1c23
  // =========
  const linkedByIndex = {};
  dataset.links.forEach(d => {
    linkedByIndex[`${d.source.index},${d.target.index}`] = 1;
  });

  function isConnected(a, b) {
    return linkedByIndex[`${a.index},${b.index}`] || linkedByIndex[`${b.index},${a.index}`] || a.index === b.index;
  }

  function fade(opacity) {
    return d => {
      nodes.style('stroke-opacity', function (o) {
        const thisOpacity = isConnected(d, o) ? 1 : opacity;
        this.setAttribute('fill-opacity', thisOpacity);
        return thisOpacity;
      });

      links.style('stroke-opacity', o => (o.source === d || o.target === d ? 1 : opacity));
    };
  }
  // ========= End Sourced Code ========= 
});



 
// ===================== IMPORTED HELPER FUNCTIONS =====================

// Wait for the window to load, otherwise some of the variables below won't be declared
window.onload = function(){
// ===================== PARTICLE TICK AND DRAW =====================

// ========= 
// The following two functions, tick() and drawParticlePathOnCanvas() are based on Micah Stubb's code
// SOURCE: https://bl.ocks.org/micahstubbs/ed0ae1c70256849dab3e35a0241389c9
// =========

// First setup two unnested variables
// Start the particle timer, tick(), after a 1 second delay; the elapsed time will be automatically passed to the callback
  var t = d3.timer(tick);

  // Start with 0 particles; the populated array is contained within the tick function
  let particles = [];

  // Start running the particles as soon as the window loads, then every 5 seconds
  createParticlesThenDispatch(d3.now());
  d3.interval( e => createParticlesThenDispatch(e), 5000);
  
  function createParticlesThenDispatch(elapsed){
    if (particles.length > 1)
      return

    // Filter the particle array from the previous tick() and check for selected node
    particles = particles.filter(d => d.current < d.path.getTotalLength());
    if (clickedNode !== null)
      particles = particles.filter(d => d.link.pathArr[0] === clickedNode);
    
    d3.selectAll('path.link')
      .each( function(d) { // DO NOT CONVERT TO ARROW FUNCTION, `this` will not bind, and you won't be able to access the SVG path properly
        // Update the particle array
        particles.push({
          link: d,
          time: elapsed,
          // offset,
          path: this,
          length: this.getTotalLength(),
          animateTime: length,
          speed: .75
        });
      });

      // With updated particle array and elapsed time, draw those particles on the canvas
      drawParticlePathOnCanvas(elapsed);
  }

  // Tick function is for the particles
  // d3.timer passes elapsed time as first argument
  function tick(elapsed){
    // Filter the particle array from the previous tick()
    particles = particles.filter(d => d.current < d.path.getTotalLength());
    if (clickedNode !== null)
      particles = particles.filter(d => d.link.pathArr[0] === clickedNode);

    // With updated particle array and elapsed time, draw those particles on the canvas
    drawParticlePathOnCanvas(elapsed);
  };

  function drawParticlePathOnCanvas(elapsed){
    // Set the canvas before drawing updated particles
    context.clearRect(0, 0, d3W, d3H);

    context.fillStyle = colorArr[1]; // particle color

    // For each particle `p` in particles find the current position and draw to the canvas
    for (const p in particles){
      // Exclude prototye chain inherited properties:
      // {} and .call are the safest ways: https://eslint.org/docs/rules/no-prototype-builtins
      if( {}.hasOwnProperty.call(particles, p) ){
        const currentTime = elapsed - particles[p].time;
        particles[p].current = currentTime * 0.15 * particles[p].speed;

        const currentPos = particles[p].path.getPointAtLength(particles[p].current);

        // Draw the particles
        context.beginPath();
        context.arc( // creates a circle in canvas
          currentPos.x + margin.left, // Add particles[p].offset for displacement
          currentPos.y + margin.top,
          particles[p].link.particleSize, // radius of circle
          0, // circle starting position
          2 * Math.PI  // circle ending position
        );
        context.lineWidth = 2;
        context.stroke();
        context.fill();

      } 
    }
  } 
}
// ========= End Sourced Code ========= 

// ========== Canvas Setup ==========
// Based on @MyNameIsKo's helper function ( https://stackoverflow.com/a/15666143/8585320 )
function createProperResCanvas(w, h, ratio) {
    if (!ratio) { ratio = Math.round(window.devicePixelRatio) || 1 }

    // Keep canvas within the allowable size:
    // https://stackoverflow.com/a/11585939/8585320
    h = Math.min(32767, h * ratio);

    // Set canvas
    var can = document.querySelector("#graph-canvas");
    can.width = w * ratio;
    can.height = h;
    can.style.width = w + "px";
    can.style.height = ratio > 1 ? h/2 + "px" : h + "px";

    // Set context
    var ctx = can.getContext("2d");
    ctx.scale(ratio,ratio);
    ctx.clearRect(0, 0, w, h);

    // Since context does all of the drawing, no need to return canvas itself
    return ctx;
}