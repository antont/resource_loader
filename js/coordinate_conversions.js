var convertGPStoScene = function(lat,lon) {
    //This works, though the "width" value is just a guess that happens to work.

    //lat and lon are the coordinates we want to convert to a local coordinate in xz plane.
    //zerolat and zerolon are the coordinates of the origin of the scene, i, this case zerolat=65.0133392, zerolon=25.4647507
    
    var tilesize = 20; //Width of a map tile in scene coordinates.
	//var tilesize = 4; //Width of a map tile in scene coordinates.
//    var zerolat = 65.0133392;
//    var zerolon = 25.4647507;
	
    //var zerolat = 65.012666;
    //	var zerolon = 25.471526;

    var zerolat = 65.012165;
    var zerolon = 25.473305;
	
    
//    var width = 2448; //This works for zoom level 15. It's supposed to be the width of the tile in web mercator coordinates.

	var width = 45; //This works for zoom level 15. It's supposed to be the width of the tile in web mercator coordinates.

    var coords = proj4('EPSG:4326','EPSG:3857',[lon,lat]);
    var zerocoords = proj4('EPSG:4326','EPSG:3857',[zerolon,zerolat]);
    
    var differencex = coords[0]-zerocoords[0];
    var differencey = -(coords[1]-zerocoords[1]);
	//var differencey = (coords[1]-zerocoords[1]);
    
    //Return values are scaled according to the scene coordinates.
    return new THREE.Vector3(tilesize * (differencex / width),0, tilesize * (differencey / width));
}

var convertScenetoGPS = function(x,z) {
    //This does the opposite conversion, from scene coordinate to a GPS coordinate.
    
    var tilesize = 20; //Width of a map tile in scene coordinates.
//    var zerolat = 65.0133392;
//    var zerolon = 25.4647507;
	var zerolat = 65.012666;
	var zerolon = 25.471526;

    var zerocoords = proj4('EPSG:4326','EPSG:3857',[zerolon,zerolat]);
    
    var width = 2448; //This works for zoom level 15. It's supposed to be the width of the tile in web mercator coordinates.
    
    var mercatorxdiff = x*width/tilesize;
    var mercatorydiff = -z*width/tilesize;
    
    coordx = zerocoords[0] + mercatorxdiff;
    coordy = zerocoords[1] + mercatorydiff;
    
    var gpscoords = proj4('EPSG:3857','EPSG:4326',[coordx,coordy]);
    
    return {lon: gpscoords[0], lat:gpscoords[1]};
}

var deg2rad = function (deg) {
    return (deg * (Math.PI/180));
}

