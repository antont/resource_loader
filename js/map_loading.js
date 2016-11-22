var prevx;
var prevz;

function MapLoader(cameraroot,camera) {

    var _this = this;
    _this._ENABLE_BUILDINGS = true;
    _this._ENABLE_FORESTS = true;
    _this._ENABLE_PLANTS = true;
    
    _this._LOW_QUALITY = 13; //Lowest zoom level
    _this._MED_QUALITY = 15; //Medium zoom level
    _this._HIGH_QUALITY = 17; //Highest zoom level
    
    //_this._TILE_SIZE_15 = 20.0; //Tile size at zoom level 15 for reference
	_this._TILE_SIZE_15 = 20.0; //Tile size at zoom level 15 for reference
    
    _this._TILE_SIZE_LOW = Math.pow(2,15) * _this._TILE_SIZE_15 / Math.pow(2,_this._LOW_QUALITY);; //Tile size at lowest zoom level
    _this._TILE_SIZE_MED = Math.pow(2,15) * _this._TILE_SIZE_15 / Math.pow(2,_this._MED_QUALITY);; //Tile size at medium zoom level
    _this._TILE_SIZE_HIGH = Math.pow(2,15) * _this._TILE_SIZE_15 / Math.pow(2,_this._HIGH_QUALITY);; //Tile size at highest zoom level
    
    // How many tiles to load in each direction around the current tile?
    _this._VISIBLE_TILE_COUNT = 1;
    // After how many tiles it is okay to remove the tiles?
    _this._FAR_TILE_MARGIN = 1;
    // How many tiles to go after the margin+visible count?
    _this._TILE_CLEAN_COUNT = 4;

    this.tileholder = new THREE.Object3D();
    this.tileholder.position.set(0,0,0);
    scene.add(this.tileholder);
    this.loadedtiles = {

    };
    
    
    this.cameraroot = cameraroot;
    this.createMapPlane = function (posx,posz,zoom) {
        var tilesize;
        if (zoom == _this._HIGH_QUALITY) {
            tilesize = _this._TILE_SIZE_HIGH;
        }
        else if (zoom == _this._MED_QUALITY) {
            tilesize = _this._TILE_SIZE_MED;
        }
        else if (zoom == _this._LOW_QUALITY) {
            tilesize = _this._TILE_SIZE_LOW;
        }

        var nexttilecoords = convertScenetoGPS(posx,posz);
        
        var lat = nexttilecoords.lat;
        var lon = nexttilecoords.lon;
        

        //Enter the latitude, longitude and zoom for the map to be loaded.
        var group = new THREE.Group();
        var loader = new THREE.TextureLoader();
        loader.crossOrigin = true;
        var googlemaps_apikey = 'AIzaSyC2pR7-yrE7OohVqm3RU2OXYx1eV_xl9-I';
        loader.load(
            'https://maps.googleapis.com/maps/api/staticmap?center='+lat+','+lon+'&zoom='+zoom+'&size=512x512&scale=1&maptype=terrain&key='+googlemaps_apikey,
            //'http://staticmap.openstreetmap.de/staticmap.php?center='+lat+','+lon+'&zoom='+(zoom)+'&size=512x512&maptype=mapnik',
            function ( texture ) {
                var geometry = new THREE.PlaneGeometry( tilesize,tilesize );
                var material = new THREE.MeshBasicMaterial( { map: texture} );
                var mesh = new THREE.Mesh( geometry, material );
                mesh.position.set(posx,zoom/1000,posz);
                mesh.rotateX( Math.PI / -2 );
                group.add( mesh );
            }
        )
        var zoomstr = zoom.toString();
        this.loadedtiles[zoomstr][xstr][zstr] = group;
        this.tileholder.add(this.loadedtiles[zoomstr][xstr][zstr]);
    };
    
    this.updateMap = function() {
        //Getting the center point of the tile the camera is looking at at each zoom level.
        var posxlow = this.cameraroot.position.x / _this._TILE_SIZE_LOW;
        var poszlow = this.cameraroot.position.z / _this._TILE_SIZE_LOW;
        
        var posxmed = this.cameraroot.position.x / _this._TILE_SIZE_MED;
        var poszmed = this.cameraroot.position.z / _this._TILE_SIZE_MED;
        
        var posxhigh = this.cameraroot.position.x / _this._TILE_SIZE_HIGH;
        var poszhigh = this.cameraroot.position.z / _this._TILE_SIZE_HIGH;
        
        posxlow = _this._TILE_SIZE_LOW*Math.round(posxlow);
        poszlow = _this._TILE_SIZE_LOW*Math.round(poszlow);
        
        posxmed = _this._TILE_SIZE_MED*Math.round(posxmed);
        poszmed = _this._TILE_SIZE_MED*Math.round(poszmed);
        
        posxhigh = _this._TILE_SIZE_HIGH*Math.round(posxhigh);
        poszhigh = _this._TILE_SIZE_HIGH*Math.round(poszhigh);
        
        
        //Load the buildings inside a medium quality tile.
        if (prevx != posxmed || prevz != poszmed) {
            var lowerleftcoords = convertScenetoGPS(posxmed-(_this._TILE_SIZE_MED/2.0),poszmed+(_this._TILE_SIZE_MED/2.0));
            var upperrightcoords = convertScenetoGPS(posxmed+(_this._TILE_SIZE_MED/2.0),poszmed-(_this._TILE_SIZE_MED/2.0));
            
            if (_this._ENABLE_BUILDINGS) {
                getBuildingsAndDraw(lowerleftcoords.lat, lowerleftcoords.lon,upperrightcoords.lat, upperrightcoords.lon);
            }
            if (_this._ENABLE_FORESTS) {
                getForestsAndDraw(lowerleftcoords.lat, lowerleftcoords.lon,upperrightcoords.lat, upperrightcoords.lon);
            }
            if (_this._ENABLE_PLANTS) {
                getPlantsAndDraw(lowerleftcoords.lat, lowerleftcoords.lon,upperrightcoords.lat, upperrightcoords.lon);
            }
        }
        
        prevx = posxmed;
        prevz = poszmed;
        
        //Check whether the tiles near the camera exist.
        if (camera.position.z < 20) {
            this.checkAndCreate(posxhigh,poszhigh,_this._HIGH_QUALITY,_this._TILE_SIZE_HIGH);
        }
        if (camera.position.z < 70) {
            this.checkAndCreate(posxmed,poszmed,_this._MED_QUALITY,_this._TILE_SIZE_MED);
        }
        this.checkAndCreate(posxlow,poszlow,_this._LOW_QUALITY,_this._TILE_SIZE_LOW);

        
        this.checkAndRemove(posxlow,poszlow,_this._LOW_QUALITY,_this._TILE_SIZE_LOW);
        this.checkAndRemove(posxmed,poszmed,_this._MED_QUALITY,_this._TILE_SIZE_MED);
        this.checkAndRemove(posxhigh,poszhigh,_this._HIGH_QUALITY,_this._TILE_SIZE_HIGH);
    }
    
    this.createTile = function(posx,posz,zoom) {
        //Check if tile exists, create if it doesn't.
        xstr = posx.toString();
        zstr = posz.toString();
        zoomstr = zoom.toString();
        
        if (zoomstr in this.loadedtiles) {
            if (xstr in this.loadedtiles[zoomstr]) {
                if (zstr in this.loadedtiles[zoomstr][xstr] && this.loadedtiles[zoomstr][xstr][zstr] != null) {
                    if (this.loadedtiles[zoomstr][xstr][zstr].parent != this.tileholder) {
                        console.log("Tile already in memory!")
                        //Tile has been created and it's in memory, but it's not on the scene. 
                        this.tileholder.add(this.loadedtiles[zoomstr][xstr][zstr]);
                    }
                }
                else {
                    this.createMapPlane(posx,posz,zoom);
                }
            }
            else {
                this.loadedtiles[zoomstr][xstr] = {};
                this.createMapPlane(posx,posz,zoom);
            }
        }
        else {
            this.loadedtiles[zoomstr] = {};
            this.loadedtiles[zoomstr][xstr] = {};
            this.createMapPlane(posx,posz,zoom);
        }
    }
    
    this.checkAndCreate = function(posx,posz,zoomlevel,tilesize) {
        for(
            var x = -_this._VISIBLE_TILE_COUNT;
            x <= _this._VISIBLE_TILE_COUNT;
            x++
            ) {
            for(
                var y = -this._VISIBLE_TILE_COUNT;
                y <= _this._VISIBLE_TILE_COUNT;
                y++
            ) {
                this.createTile(
                    posx + (x * tilesize),
                    posz + (y * tilesize),
                    zoomlevel
                    );
            }
        }
        
    }
    
    this.checkAndRemove = function(posx,posz,zoomlevel,tilesize) {
        //This removes faraway tiles from memory.
        
        //There's probably a better way to do this than have all these loops going through the tiles around the middle area.
        for(
            var x = -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
            x <= -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
            x++
            ) {
            for(
                var y = (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
                y >= -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
                y--
                ) {
                this.removeTile(
                    posx + (x * tilesize),
                    posz + (y * tilesize),
                    zoomlevel
                    );
            }
        }

        for(
            var x = (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
            x >= (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
            x--
            ) {
            for(
                var y = (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
                y >= -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
                y--
                ) {
                this.removeTile(
                    posx + (x * tilesize),
                    posz + (y * tilesize),
                    zoomlevel
                    );
            }
        }

        for(
            var y = (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
            y >= (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
            y--
            ) {
            for(
                var x = (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
                x >= -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
                x--
                ) {
                this.removeTile(
                    posx + (x * tilesize),
                    posz + (y * tilesize),
                    zoomlevel
                    );
            }
        }

        for(
            var y = -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN + _this._TILE_CLEAN_COUNT);
            y <= -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
            y++
            ) {
            for(
                var x = (_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
                x >= -(_this._VISIBLE_TILE_COUNT + _this._FAR_TILE_MARGIN);
                x--
                ) {
                this.removeTile(
                    posx + (x * tilesize),
                    posz + (y * tilesize),
                    zoomlevel
                    );
            }
        }
    }
    
    this.removeTile = function(posx,posz,zoom) {
        //Check if tile exists, delete if it does
        xstr = posx.toString();
        zstr = posz.toString();
        zoomstr = zoom.toString();
        
        if (zoomstr in this.loadedtiles) {
            if (xstr in this.loadedtiles[zoomstr]) {
                if (zstr in this.loadedtiles[zoomstr][xstr]) {
                    this.tileholder.remove( this.loadedtiles[zoomstr][xstr][zstr] );
                    this.loadedtiles[zoomstr][xstr][zstr] = null;
                }
            }
        }
    }
}

