var SHAPES_URL = "http://vm0109.virtues.fi/api/gtfs/shape/";
var TRIPS_URL = "http://vm0109.virtues.fi/api/gtfs/trips";
var VEHICLES_URL = "http://vm0109.virtues.fi/api/siri/vehicle";

//List of available URLs: http://wiki.openstreetmap.org/wiki/Overpass_API
//var OVERPASS_URL = "http://overpass.osm.rambler.ru/cgi/interpreter?data=%5Bout:json%5D;"
var OVERPASS_URL = "http://api.openstreetmap.fr/oapi/interpreter?data=%5Bout:json%5D;"
//var OVERPASS_URL = "http://overpass-api.de/api/interpreter?data=%5Bout:json%5D;"


var STOPS_URL = "http://vm0109.virtues.fi/api/gtfs/stops/route_id/"

var trips = null;
var vehicles = null;

var buildingRequest = null;
var forestRequest = null;
var plantRequest = null;

var getVehicles = function() {
    //Gets all vehicles and saves them into the variable vehicles.
    $.getJSON( VEHICLES_URL, function( data ) {
        vehicles = data;
    });
}


var drawnRoutes = [];
var drawnStops = [];

//Remove route if it exists
function removeRoute(route_id){
    for(var v in drawnRoutes){

    console.log(v);
    
    var item = drawnRoutes[v];
        if(parseInt(route_id) == item["id"]){
        
            scene.remove(item["mesh"]);
            drawnRoutes.splice(drawnRoutes.indexOf(item), 1);

            return true;
        }
    }
    return false;

}

//Remove stops if exists
function removeStops(route_id){
    for(var v in drawnStops){

    
        var item = drawnStops[v];
        if(parseInt(route_id) == item["id"]){
        

            var meshes = item["mesh"];
            
            for(var i in meshes){
                stops.remove(meshes[i]);
            }

            drawnStops.splice(drawnStops.indexOf(item), 1);
            
            return true;
        }
    }
    return false;

}
/*
*/


var getShapeAndDraw = function(route_id, direction) {
    //Gets the data and calls drawRoute
    if(removeRoute(route_id)){
        return false;
    }

    
    var shape_id = getShapeId(route_id, direction);
    $.getJSON( SHAPES_URL+shape_id, function( data ) {
        var m = drawRoute(data);
        
        var r = {
            id: route_id,
            mesh: m
        }
        
        drawnRoutes.push(r);

    });
    
    return true;
}

var getStopsAndDraw = function(route_id, direction){
    if(removeStops(route_id)){
        return;
    }


    $.getJSON( STOPS_URL+route_id, function( data ) {
        var meshes = drawStops(data);
        
        var sStops = {
            id: route_id,
            mesh: meshes
        }
        drawnStops.push(sStops);
    
    });

}
/*
*/
var getTrips = function() {
    //Gets all trips and saves them into the variable trips.
    $.getJSON( TRIPS_URL, function( data ) {
        trips = data;
    });
}

var getShapeId = function(route_id,direction) {
    //Gets a shape id for a trip that has route_id and direction (true/false).
    for( var i=0; i<trips.length; i++ ) {
        var trip = trips[i];
        if (trip.route_id == route_id && trip.direction_id == direction) {
            return trip.shape_id;
        }
    }
}

var getBuildingsAndDraw = function(lat1, lon1, lat2, lon2) {
   //Gets the buildings in a bounding box and draws them
   
   //Creating the query
   var boundingbox = ""+lat1+","+lon1+","+lat2+","+lon2;
   var query = "( way [\"building\"] ("+boundingbox+"); rel [\"building\"] ("+boundingbox+"); way [\"building:part\"] ("+boundingbox+"); rel [\"building:part\"] ("+boundingbox+"); ); (._;>;); out meta;";
   //var query = "( rel [\"amenity\"=\"university\"] ("+boundingbox+"); ); (._;>;); out meta;";
   console.log(query);
   //Encoding ASCII
   query = encodeURIComponent(query);
    
    if (buildingRequest != null) {
        //Stopping any earlier request, for example if the camera has moved.
        buildingRequest.abort();
    }
   
   buildingRequest = $.getJSON( OVERPASS_URL+query, function( data ) {
        drawBuildings(data);
    });
   
}

var getForestsAndDraw = function(lat1, lon1, lat2, lon2) {
   //Gets the forests in a bounding box and draws them
   
   //Creating the query
   var boundingbox = ""+lat1+","+lon1+","+lat2+","+lon2;
   var query = "( way [\"landuse\"=\"forest\"] ("+boundingbox+"); rel [\"landuse\"=\"forest\"] ("+boundingbox+"); way [\"natural\"=\"wood\"] ("+boundingbox+"); rel [\"natural\"=\"wood\"] ("+boundingbox+"); way [\"leisure\"=\"park\"] ("+boundingbox+"); rel [\"leisure\"=\"park\"] ("+boundingbox+");); (._;>;); out meta;";
   console.log(query);
   //Encoding ASCII
   query = encodeURIComponent(query);
    
    if (forestRequest != null) {
        //Stopping any earlier request, for example if the camera has moved.
        forestRequest.abort();
    }
   
   forestRequest = $.getJSON( OVERPASS_URL+query, function( data ) {
        drawForests(data);
    });
   
}

var getForestsAndDraw = function(lat1, lon1, lat2, lon2) {
   //Gets the forests in a bounding box and draws them
   
   //Creating the query
   var boundingbox = ""+lat1+","+lon1+","+lat2+","+lon2;
   var query = "( way [\"landuse\"=\"forest\"] ("+boundingbox+"); rel [\"landuse\"=\"forest\"] ("+boundingbox+"); way [\"natural\"=\"wood\"] ("+boundingbox+"); rel [\"natural\"=\"wood\"] ("+boundingbox+"); ); (._;>;); out meta;";
   console.log(query);
   //Encoding ASCII
   query = encodeURIComponent(query);
    
    if (forestRequest != null) {
        //Stopping any earlier request, for example if the camera has moved.
        forestRequest.abort();
    }
   
   forestRequest = $.getJSON( OVERPASS_URL+query, function( data ) {
        drawForests(data);
    });
   
}

var getPlantsAndDraw = function(lat1, lon1, lat2, lon2) {
   //Gets the plant areas in a bounding box and draws them
   
   //Creating the query
   var boundingbox = ""+lat1+","+lon1+","+lat2+","+lon2;
   var query = "( way [\"natural\"=\"scrub\"] ("+boundingbox+"); rel [\"natural\"=\"scrub\"] ("+boundingbox+"); way [\"landuse\"=\"meadow\"] ("+boundingbox+"); rel [\"landuse\"=\"meadow\"] ("+boundingbox+"); way [\"leisure\"=\"park\"] ("+boundingbox+"); rel [\"leisure\"=\"park\"] ("+boundingbox+"); way [\"landuse\"=\"grass\"] ("+boundingbox+"); rel [\"landuse\"=\"grass\"] ("+boundingbox+");); (._;>;); out meta;";
   console.log(query);
   //Encoding ASCII
   query = encodeURIComponent(query);
    
    if (plantRequest != null) {
        //Stopping any earlier request, for example if the camera has moved.
        plantRequest.abort();
    }
   
   plantRequest = $.getJSON( OVERPASS_URL+query, function( data ) {
        drawPlants(data);
    });
   
}
    

    