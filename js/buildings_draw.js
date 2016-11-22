FixedUVGenerator = {
     //This doesn't stretch textures. Original: https://github.com/mrdoob/three.js/blob/master/src/extras/geometries/ExtrudeGeometry.js
	generateTopUV: function ( geometry, indexA, indexB, indexC ) {

		var vertices = geometry.vertices;

		var a = vertices[ indexA ];
		var b = vertices[ indexB ];
		var c = vertices[ indexC ];

		return [
			new THREE.Vector2( a.x, a.y ),
			new THREE.Vector2( b.x, b.y ),
			new THREE.Vector2( c.x, c.y )
		];

	},

	generateSideWallUV: function ( geometry, indexA, indexB, indexC, indexD ) {

		var vertices = geometry.vertices;

		var a = vertices[ indexA ];
		var b = vertices[ indexB ];
		var c = vertices[ indexC ];
		var d = vertices[ indexD ];
        
        var angle = Math.atan( Math.abs((a.y - b.y) / (a.x - b.x)));
        //console.log("y: " + (a.y-b.y));
        //console.log("x: " + (a.x-b.x));
        //console.log("y: " + (a.y-b.y) + " x: " + (a.x-b.x) + " angle: " + angle);
		if (angle < (Math.PI/4) ) { //The original simply checked the difference between y values, here we actually check the angle.
			return [
				new THREE.Vector2( a.x, 1 - a.z ),
				new THREE.Vector2( b.x, 1 - b.z ),
				new THREE.Vector2( c.x, 1 - c.z ),
				new THREE.Vector2( d.x, 1 - d.z )
			];

		} else {
			return [
				new THREE.Vector2( a.y, 1 - a.z ),
				new THREE.Vector2( b.y, 1 - b.z ),
				new THREE.Vector2( c.y, 1 - c.z ),
				new THREE.Vector2( d.y, 1 - d.z )
			];

		}

	}
};

var nodes = [];
var ways = [];
var waybuildings = [];
var relationbuildings = [];

var buildings = [];


var wayforests = [];
var relationforests = [];
var forests = [];

var wayplants = [];
var relationplants = [];
var plants = [];

//var worldscale = 20 / 1050; //Assuming that 20 units (one tile at zoom level 15) is roughly 1050 real meters wide.
var worldscale = 1 / 1; //Assuming that 20 units (one tile at zoom level 15) is roughly 1050 real meters wide.
            
var lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff00
});

var loader = new THREE.TextureLoader();

//var walltexture = loader.load("textures/tilewall_window.png");
//var rooftexture = loader.load("textures/rooftile.png");

var walltexture = loader.load("images/tilewall_window.png");
var rooftexture = loader.load("images/rooftile.png");

walltexture.wrapS = THREE.RepeatWrapping;
walltexture.wrapT = THREE.RepeatWrapping;
//walltexture.repeat.set( 13.9, 13.9 );
walltexture.repeat.set( 2, 2 );

rooftexture.wrapS = THREE.RepeatWrapping;
rooftexture.wrapT = THREE.RepeatWrapping;
//rooftexture.repeat.set( 13.9, 13.9 );
rooftexture.repeat.set( 2, 2 );

var buildingWallMaterial = new THREE.MeshLambertMaterial({
    map: walltexture,
    color: 0xA8E9FF,
    side: THREE.BackSide,
});

var buildingRoofMaterial = new THREE.MeshLambertMaterial({
    map: rooftexture,
    color: 0xA8E9FF,
    side: THREE.BackSide,
});

var buildingMaterial = new THREE.MeshFaceMaterial([buildingRoofMaterial,buildingWallMaterial]);

var forestMaterial = new THREE.MeshLambertMaterial({
    color: 0x56A82D,
    side: THREE.DoubleSide
});

var treeGeometry = new THREE.CylinderGeometry( 0.01, 0.2, 0.7, 4 );
var treemesh = new THREE.Mesh( treeGeometry, forestMaterial );

var plantMaterial = new THREE.MeshLambertMaterial({
    color: 0x74ED39,
    side: THREE.DoubleSide
});

var plantGeometry = new THREE.SphereGeometry( 0.1, 3, 2);
var plantmesh = new THREE.Mesh( plantGeometry, plantMaterial );

function WorldObject (mesh, middlePoint) {

    this.mesh = mesh;
    
    this.middlePoint = middlePoint; //The center point of the building
    this.gpsPoint = convertScenetoGPS(middlePoint.x,middlePoint.z);
    
    this.show = function() {
        scene.add(this.mesh);
    }
    
    this.remove = function() {
        scene.remove(this.mesh);
    };
}

function drawBuildings(data) {
    //Draws the buildings in the dataset.
    
    //Initializing
    buildings = removeAll(buildings);
    var elements = data.elements;
    
    initializeArrays(elements);
    
    //Draws the buildings which are ways (collection of nodes).
    drawWays(waybuildings, null, null, null, buildingMaterial, buildings);
    
    drawRelations(relationbuildings, 8, 0, buildingMaterial, buildings);
}


function drawForests(data) {
    //Draws the forests in the dataset.
    
    //Initializing
    forests = removeAll(forests);
    var elements = data.elements;

    initializeArrays(elements);
    
    //Draws the forests which are ways (collection of nodes).
    
    var height_array = [];
    var minheight_array = [];
    for (var i = 0; i<wayforests.length;i++) {
        height_array.push(1);
        minheight_array.push(0);
    }
    
    drawWays(wayforests, height_array, minheight_array, null, forestMaterial, forests, treemesh);
    
    drawRelations(relationforests, 1, 0, forestMaterial, forests, treemesh);
}


function drawPlants(data) {
    //Draws the scrubs, meadows and parks in the dataset.
    
    //Initializing
    plants = removeAll(plants);
    var elements = data.elements;

    initializeArrays(elements);
    
    //Draws the plants which are ways (collection of nodes).

    var height_array = [];
    var minheight_array = [];
    for (var i = 0; i<wayplants.length;i++) {
        height_array.push(1);
        minheight_array.push(0);
    }
    
    drawWays(wayplants, height_array, minheight_array, null, plantMaterial, plants, plantmesh);
    drawRelations(relationplants, 1, 0, plantMaterial, plants, plantmesh);
}

function drawRelations(relations, height, min_height, material, target, fill) {
    //Draws relations (collection of ways).
    var outerways = [];
    var holes = [];
    var height_array = [];
    var minheight_array = [];
    for (var i=0; i<relations.length; i++) {
        holes.push([]);
        var thisrelation = relations[i];
        theseways = [];
        
        //Checks if there's height data for this building
        if ("tags" in thisrelation) {
            if ("height" in thisrelation["tags"]) {
                height = parseInt(thisrelation["tags"]["height"]);
            }
            else if ("building:levels" in thisrelation["tags"]) {
                height = parseInt(thisrelation["tags"]["building:levels"])*4;
            }
            if ("min_height" in thisrelation["tags"]) {
                min_height = parseInt(thisrelation["tags"]["min_height"]);
            }
            else if ("building:min_level" in thisrelation["tags"]) {
                min_height = (parseInt(thisrelation["tags"]["building:min_level"]) - 1) * 4;
            }
        }
        height_array.push(height);
        minheight_array.push(min_height);
        //Adds all outer ways into a single way, and adds inner ways into a holes array.
        var nodes_temp = [];
        for (var j=0;j<thisrelation["members"].length;j++) {
            //console.log(nodes_temp.length);
            if (outerways.length <= i && thisrelation["members"][j]["role"] == "outer") {
                outerways.push(getWay(thisrelation["members"][j]["ref"]));
                nodes_temp.push(getWay(thisrelation["members"][j]["ref"])["nodes"]);
            }
            else if (thisrelation["members"][j]["role"] == "outer") {
                nodes_temp.push(getWay(thisrelation["members"][j]["ref"])["nodes"]);
            }
            else if (thisrelation["members"][j]["role"] == "inner") {
                holes[i].push(getWay(thisrelation["members"][j]["ref"]));
            }
        }
        if (nodes_temp.length > 0) {
            newnodes = orderNodes(nodes_temp);
            outerways[i]["nodes"] = newnodes;
        }
    }
    if (outerways.length > 0) {
        drawWays(outerways, height_array, minheight_array, holes, material, target, fill);
    }

}

function drawWays(array, height_array, minheight_array, holes, material, target, fill) {
    //Draws buildings defined by an array of ways. Height parameters can be given, if taken from relation building.
    for (var i=0; i<array.length; i++) {
        var thisway = array[i];
        var height;
        var min_height;
        
        //Checks if height was given as a parameter
        if (minheight_array == null) {
            min_height = 0;
        }
        else {
            min_height = minheight_array[i];
        }
        if (height_array == null) {
            height = 8;
        }
        else {
            height = height_array[i];
        }
        

        if (thisway != null) {
            
            //Checks if there's height data
            if ("tags" in thisway) {
                if ("height" in thisway["tags"]) {
                    height = parseInt(thisway["tags"]["height"]);
                }
                else if ("building:levels" in thisway["tags"]) {
                    height = parseInt(thisway["tags"]["building:levels"])*4;
                }
                if ("min_height" in thisway["tags"]) {
                    min_height = parseInt(thisway["tags"]["min_height"]);
                }
                else if ("building:min_level" in thisway["tags"]) {
                    min_height = (parseInt(thisway["tags"]["building:min_level"]) - 1) * 4;
                }
            }
            if (height == 0) {
                height = 8;
            }
            //Converting height to world scale
            height = worldscale * height;
            min_height = worldscale * min_height;
    
            middlePoint = new THREE.Vector3(0,0,0);
            //Adds the vertices.
            var shape = new THREE.Shape();
            if (thisway["nodes"] != null) {
                for (var j=0;j<thisway["nodes"].length;j++) {
                    var thisnode = getNode(thisway["nodes"][j]);
                    if (thisnode != null){
                        var xyz = convertGPStoScene(thisnode["lat"], thisnode["lon"]);
                        if (j == 0) {
                            shape.moveTo( xyz.x,xyz.z );
                        }
                        else {
                            shape.lineTo( xyz.x, xyz.z );
                        }
                        middlePoint.add(xyz);
                    }
                }
                                            
                middlePoint.divideScalar(thisway["nodes"].length); //Average of all nodes
            

            
                //Creating the roof holes
                if (holes != null) {
                    var theseholes = holes[i];
                    for (h = 0; h < theseholes.length; h++) {
                        thishole = theseholes[h];
                        if (thishole != null) {
                            var holepath = new THREE.Path();
                            for (n = 0; n < thishole["nodes"].length; n++) {
                                var thisnode = getNode(thishole["nodes"][n]);
                                if (thisnode != null){
                                    var xyz = convertGPStoScene(thisnode["lat"], thisnode["lon"]);
                                    if (n==0) {
                                        holepath.moveTo(xyz.x, xyz.z);
                                    }
                                    else {
                                        holepath.lineTo(xyz.x, xyz.z);
                                    }
                                }
                            }
                        }
                        shape.holes.push(holepath); 
                    }
                }
                
                var extrudeSettings = {
                    bevelEnabled : false,
                    steps: 1,
                    amount: -height,
                    material:0,
                    extrudeMaterial : 1,
                    UVGenerator: FixedUVGenerator
                };

                var mesh;
                if (height > 0.02) {
                    var geometry = new THREE.ExtrudeGeometry( shape, extrudeSettings );
                    mesh = new THREE.Mesh( geometry, material );   
                    mesh.position.set(mesh.position.x, min_height, mesh.position.z);
                }
                else {
                    var geometry = new THREE.ShapeGeometry( shape );
                    mesh = new THREE.Mesh( geometry, material );   
                    mesh.position.set(mesh.position.x, height, mesh.position.z);
                }
                
                //Just checking if the middlepoints are in the right place
                //cube = new THREE.Mesh( new THREE.CubeGeometry( 0.1, 2, 0.1 ), new THREE.MeshNormalMaterial() );
                //cube.position.set(middlePoint.x,middlePoint.y,middlePoint.z);
                //scene.add(cube);

                //mesh.position.set(mesh.position.x, 0.5, mesh.position.z);
                //Must rotate, otherwise will go along the y axis
                mesh.rotation.set(Math.PI/2, 0, 0);
                
                if (fill != undefined && fill != null) {
                    fillWithObjects(mesh,fill,target);
                }
                
                worldobject = new WorldObject(mesh, middlePoint);
                worldobject.show();
                target.push(worldobject);
            }
        }
    }

}

var fillWithObjects = function(targetmesh,object,target) {
    //http://stackoverflow.com/questions/32515390/how-to-put-a-circle-in-a-random-part-of-the-face-top-of-my-meshthree-js
    var cst = new THREE.Raycaster();

   // new random point 
   var box = new THREE.Box3().setFromObject(targetmesh);
   var size = Math.abs(box.min.x * box.min.z);
   size = Math.min(size, 1000);
   for (var i = 0; i<size; i++) {
   
       var point = new THREE.Vector3(
                (box.min.x-5) + (box.max.x+5-box.min.x)*Math.random(),
                box.max.y+10,
                (box.min.z-5) + (box.max.z+5-box.min.z)*Math.random()
       );

       // check if point on mesh in y-direction
       cst.set(point, new THREE.Vector3(0,-1,0)); // direction of gravity        
       var cls = cst.intersectObjects( [targetmesh] );
       if (cls.length>0) {
            objectclone = object.clone();
            objectclone.position.set( point.x,targetmesh.position.y,point.z );
            worldobject = new WorldObject(objectclone, objectclone.position);
            worldobject.show();
            target.push(worldobject);
       }
   }

}


function initializeArrays(elements) {
    //Initializing data arrays
    nodes = [];
    ways = [];
    waybuildings = [];
    relationbuildings = [];
    
    wayforests = [];
    relationforests = [];
    
    wayplants = [];
    relationplants = [];
    
    takenways = [];

    for( var i=0; i<elements.length; i++ ) {
        var element = elements[i];
        
        if (element["type"] == "relation") {
            if (("building" in element["tags"] || "building:part" in element["tags"])) {
                //Relation buildings (references ways)
                relationbuildings.push(element);
            }
            else if (element["tags"]["landuse"] == "forest" || element["tags"]["natural"] == "wood") {
                relationforests.push(element);
            }
            
            else if (element["tags"]["natural"] == "scrub" || element["tags"]["leisure"] == "park" || element["tags"]["landuse"] == "meadow" || element["tags"]["landuse"] == "grass") {
                relationplants.push(element);
            }
            
            if ("members" in element) {
                for (var j=0; j < element["members"].length; j++) {
                    takenways.push(element["members"][j]["ref"]);
                }
            }
        }
    }
    for( var i=0; i<elements.length; i++ ) {
        var element = elements[i];    
        if (element["type"] == "way"){
            if ("tags" in element && takenways.indexOf(element["id"]) < 0) {
                if ("building" in element["tags"] || "building:part" in element["tags"]) {
                    //Ways which are buildings
                    waybuildings.push(element);
                }
                else if (element["tags"]["landuse"] == "forest" || element["tags"]["natural"] == "wood") {
                    wayforests.push(element);
                }
                
                else if (element["tags"]["natural"] == "scrub" || element["tags"]["leisure"] == "park" || element["tags"]["landuse"] == "meadow" || element["tags"]["landuse"] == "grass") {
                    wayplants.push(element);
                }
                
                else {
                    //Ways which are not buildings or forests (referenced by a relation)
                    ways.push(element);
                }
            }
            else {
                ways.push(element);
            }
        }
        
        else if (element["type"] == "node") {
            //Just nodes
            nodes.push(element);
        }
    }
}

var getNode = function(id) {
    //Gets a node (single point) by id
    for( var i=0; i<nodes.length; i++ ) {
        if (nodes[i]["id"] == id) {
            return nodes[i];
        }
    }
    return null;
}

var getWay = function(id) {
    //Gets a way (collection of points) by id.
    for( var i=0; i<ways.length; i++ ) {
        if (ways[i]["id"] == id) {
            return ways[i];
        }
    }
    for( var i=0; i<waybuildings.length; i++ ) {
        if (waybuildings[i]["id"] == id) {
            return waybuildings[i];
        }
    }
    for( var i=0; i<wayforests.length; i++ ) {
        if (wayforests[i]["id"] == id) {
            return wayforests[i];
        }
    }
    return null;
}

var removeAll = function(target) {
    //Removes all objects in target
    for (var i = target.length - 1; i >= 0 ; i -- ) {
        target[i].remove();
    }
    target = [];
    return target;
}

var orderNodes = function(ways_array) {
    //Apparently ways in relations aren't always in the right order so we need to order them.
    var used_ways = [];
    
    var actual_nodes = [];
    var way = ways_array[0];  //First way
    //console.log(way);
    //console.log(way);
    var nextnode = way[way.length-1]; //Last node of the first way
    
    actual_nodes = actual_nodes.concat(way);
    used_ways.push(0);
    stopper = 0;
    while (used_ways.length < ways_array.length && stopper < 500) {
        stopper ++;
        for (var i = 0; i < ways_array.length; i++) {
            if (used_ways.indexOf(i) > -1) {
                continue;
            }
            else {
                way = ways_array[i];
                if (way[0] == nextnode) {
                    way.splice(0, 1);
                    actual_nodes = actual_nodes.concat(way);
                    used_ways.push(i);
                    nextnode = way[way.length-1];
                    break;
                }
                else if (way[way.length-1] == nextnode) {
                    way.reverse();
                    way.splice(0, 1);
                    actual_nodes = actual_nodes.concat(way);
                    used_ways.push(i);
                    nextnode = way[way.length-1];
                    break;
                }
            }
        }
    }
    //console.log(actual_nodes);
    if (stopper != 500) {
        return actual_nodes;
    }
    else {
        return null;
    }
}