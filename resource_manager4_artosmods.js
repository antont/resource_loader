//Parametrit
var range = 300; // TIMO: latauskehän säde
var use_chunking = false;
var max_simultaneous_chunk_downloads = 1;
var chunk_size_bytes = 64000;    //Ladattavien chunkkien koko tavuina
var update_download_queue_interval_ms = 2000; //kuinka tiheästi latausjonoa päivitetään
var schedule_downloads_interval_ms = 1000;  //kuinka pian lataukset skeduloidaan uudelleen jos latausjono ollut tyhjä 
                                            //(yleensä valmistunut lataus triggeröi välittömästi seuraavan latauksen)

var scene = new THREE.Scene(); //scene sisältää kaikki objektit ja asiat, scenessä voi olla myös aliscenejä
var clock = new THREE.Clock(); //enpä muista käytettiinkö tätä johonkin
var cameraLocation = new THREE.Vector3(); //tällä ylläpidetään omaa sijaintia, näkyy oikeasssa ylälaidassa

var textureLoader = new THREE.TextureLoader();
var loader = new THREE.JSONLoader();

var downloadQueue = new Array(); // TIMO: latausjono
var camera;
var stats;
var camControls;
var webGLRenderer;

var num_active_chunk_downloads = 0; //Montako chunkin latausta käynnissä

function TextureImage(name, url, x, y, parentObj)  //Arvaus: y:hyn voidaan syöttää z-arvo?
{
	this.name = name;
	this.url = url;
	this.x = x;
	this.y = y;
    this.distance = 0;
	this.status = "initialized"; //Arvoja: "initialized", "full_downloading", "chunked_downloading", "chunked_paused", "finished"
	this.chunks = []
	this.num_started_chunks = 0;
    this.num_completed_chunks = 0;
    this.num_total_chunks = 0;
	this.total_size_bytes = 0;
	this.data = new Blob();
    this.addToScene = function() //Tätä kutsutaan kun datan lataus valmistuu
    {
        //Kokoaa yksittäisten chunkien datan yhden Blobin sisään
        for (i=0; i<this.chunks.length; i++) {
            if (this.chunks[i] == undefined)
                continue;
            this.data = new Blob([this.data, this.chunks[i]]);
        }
        var dataURL = URL.createObjectURL(this.data);
        
        map = textureLoader.load(dataURL);
        material = new THREE.MeshPhongMaterial( {
                color: 0xaaaaaa,
                specular: 0x222222,
                shininess: 1,
                map: map
        } );	
        
        parentObj.material = material;
    
    }
}

function Block(name, url, x, y) {
	this.name = name;
	this.url = url;
	this.x = x;
	this.y = y;
    this.distance = 0;
	this.status = "initialized"; //Arvoja: "initialized", "full_downloading", "chunked_downloading", "chunked_paused", "finished"
	this.chunks = []
	this.num_started_chunks = 0;
    this.num_completed_chunks = 0;
    this.num_total_chunks = 0;
	this.total_size_bytes = 0;
	this.data = new Blob();
    this.addToScene = function() //Tätä kutsutaan kun datan lataus valmistuu
    {
        //Kokoaa yksittäisten chunkien datan yhden Blobin sisään
        for (i=0; i<this.chunks.length; i++) {
            if (this.chunks[i] == undefined)
                continue;
            this.data = new Blob([this.data, this.chunks[i]]);
        }
        var dataURL = URL.createObjectURL(this.data);
        
        
        var scenejson = (function() {
            var scenejson = null;
			$.ajax({
				'async': false,
				'global': false,
				'url': dataURL, 
				'dataType': "json",
				'success': function (data) {
					scenejson = data;
				}
			});
			return scenejson;
		})();
	
        //Otetaan JSONista korttelin kaikki tekstuurit, geometriat, materiaalit jne. omiksi muuttujikseen
        //TODO: kaikki textuurit pitäisi lisätä omaan listaansa, kuten Blockit ovat nyt, jotta niiden lataukset voidaan skeduloida!

        var material;
        var material2;
        var geometry;
        var geometry2;
        var matrix;
        var url;
        var map;
        
        blockImages = scenejson.images;
        blockMaterials = scenejson.materials;
        blockObjects = scenejson.object;
        blockGeometries = scenejson.geometries; 
        blockTextures = scenejson.textures;	
        
        // Tässä luodaan buildingLocations -lista, johon sijoitetaan jokaisen talon koordinaatit
        blockLocation = {x:this.x, y:this.y};
        /*for (o in blockObjects.children){
            var objectx = blockObjects.children[o].matrix[12] + blockLocation['x']
            var objectz = blockObjects.children[o].matrix[13] + blockLocation['y']
                
            buildingList[blockObjects.children[o].geometry] = {x: objectx, z: objectz, blockname: blocklist[i].name, buildingname: blockObjects.children[o].name}
        }
        */
        //console.log (blockObjects);
        
        
        //Luodaan pelkkä harmaa väliaikainen materiaali
        material = new THREE.MeshLambertMaterial( {
            color: 0xD4DED7,
        } );
        
        // Tässä lisätään 3D maailmaan ko. korttelin kaikki geometria ja otetaan materiaalit URL:t talteen
        for (i in blockObjects.children){
            //console.log (blockObjects.children[i]);
            geometryuuid = blockObjects.children[i].geometry;
            materialuuid = blockObjects.children[i].material;
        
            for (g in blockGeometries){ // Geometrian käsittely
                if (geometryuuid === blockGeometries[g].uuid){
                    geometry2 = loader.parse(blockGeometries[g].data, url);
                    matrix = blockObjects.children[i].matrix;
                }
                if (geometry2 != undefined){
                newob = new THREE.Mesh(geometry2.geometry, material); // Miten tähän geometriaan saadaan myöhemmin päivitettyä materiaalit, kun niitä ei vielä tässä vaiheessa anneta?
                var x = this.x;
                var y = this.y;
                            
                newob.translateOnAxis(new THREE.Vector3(1,0,0), x);
                newob.translateOnAxis(new THREE.Vector3(0,0,1), y);
                
                newob.translateOnAxis(new THREE.Vector3(1,0,0), matrix[12]);
                newob.translateOnAxis(new THREE.Vector3(0,0,-1), matrix[13]);			
                
                //var objectx = blockObjects.children[i].matrix[12] + blockLocation['x'];
                //var objectz = blockObjects.children[i].matrix[13] + blockLocation['y'];
                
                scene.updateMatrixWorld();
                newob.updateMatrixWorld();
                
                var position = new THREE.Vector3();
                position.getPositionFromMatrix(newob.matrixWorld);
                var objectx = position.x;
                var objectz = position.z;
                
                buildingList[geometryuuid] = {x: objectx, z: objectz, objectID: newob.id};
                
                scene.add(newob);
                //console.log (buildingList);
                }
            }
            for (m in blockMaterials){ // Tekstuurien käsittely
                if (materialuuid === blockMaterials[m].uuid){
                    textureuuid = blockMaterials[m].map
                    for (t in blockTextures){
                        if (textureuuid === blockTextures[t].uuid){
                            imageuuid = blockTextures[t].image
                            for (b in blockImages){
                                if (imageuuid === blockImages[b].uuid){
                                    url = 'resources/' + blockImages[b].url;
                                    var ti = new TextureImage(blockImages[b].name, url, objectx, objectz, newob);
                                    textureimagelist.push(ti);
                                    buildingList[geometryuuid]["TextureUrl"] = url; 
                                }
                            }
                        }
                    }
                }
            }
        }	      
        //render();
    };
} 

// sisältää kaikki tiedot rakennuksista
buildingList = new Array();

//Tähän säilötään kaikki erilliset talot etäisyyksineen
allObjects = {};
buildingLocations = {};

//New blocks, with some randomness in the URLs (to avoid caching)
var a1 = new Block('a1', 'resources/testblock5.json', 0, 0);
var a2 = new Block('a2', 'resources/testblock5.json', 0, 120); 
var a3 = new Block('a3', 'resources/testblock5.json', 0, 240);
var a4 = new Block('a4', 'resources/testblock5.json', 0, 360);
var a5 = new Block('a5', 'resources/testblock5.json', 0, 480);
var b1 = new Block('b1', 'resources/testblock5.json', 120, 0);
var b2 = new Block('b2', 'resources/testblock5.json', 120, 120);
var b3 = new Block('b3', 'resources/testblock5.json', 120, 240);
var b4 = new Block('b4', 'resources/testblock5.json', 120, 360);
var b5 = new Block('b5', 'resources/testblock5.json', 120, 480);
var c1 = new Block('c1', 'resources/testblock5.json', 240, 0);
var c2 = new Block('c2', 'resources/testblock5.json', 240, 120); 
var c3 = new Block('c3', 'resources/testblock5.json', 240, 240);
var c4 = new Block('c4', 'resources/testblock5.json', 240, 360);
var c5 = new Block('c5', 'resources/testblock5.json', 240, 480);
var d1 = new Block('d1', 'resources/testblock5.json', 360, 0);
var d2 = new Block('d2', 'resources/testblock5.json', 360, 120);
var d3 = new Block('d3', 'resources/testblock5.json', 360, 240);
var d4 = new Block('d4', 'resources/testblock5.json', 360, 360);
var d5 = new Block('d5', 'resources/testblock5.json', 360, 480);
var e1 = new Block('e1', 'resources/testblock5.json', 480, 0);
var e2 = new Block('e2', 'resources/testblock5.json', 480, 120);
var e3 = new Block('e3', 'resources/testblock5.json', 480, 240);
var e4 = new Block('e4', 'resources/testblock5.json', 480, 360);
var e5 = new Block('e5', 'resources/testblock5.json', 480, 480);

//ko. blockit listassa
blocklist = [a1,a2,a3,a4,a5,b1,b2,b3,b4,b5,c1,c2,c3,c4,c5,d1,d2,d3,d4,d5,e1,e2,e3,e4,e5];
textureimagelist = []; //Tämä täytetään sitä mukaa kun blokkeja saadaan ladatuksi

function updateDownloadQueue()
{
    console.log("updateDownloadQueue() " + new Date());
    var sorted_unfinished_blocks = sortBlocks();
    var sorted_unfinished_textures = sortTextureImages();
    
    var new_dl_queue = Array();
    
    //Append to new_dl_queue first unfinished blocks, then textures
    new_dl_queue.push.apply(new_dl_queue, sorted_unfinished_blocks);
    new_dl_queue.push.apply(new_dl_queue, sorted_unfinished_textures);
    
    downloadQueue = new_dl_queue;
    //for (var idx in downloadQueue){
    //    console.log(downloadQueue[idx].name + ": " + downloadQueue[idx].distance);
    //}
    
    
}

function scheduleDownloads()
{
    console.log("scheduleDownloads() " + new Date());
    //If download queue is empty, schedule downloads again after 1 sec...
    if (downloadQueue.length == 0)
    {
        setTimeout(scheduleDownloads, schedule_downloads_interval_ms);
        return;
    }
    
    //Chunked downloads scheduling...
    if (use_chunking)
    {
        if (num_active_chunk_downloads < max_simultaneous_chunk_downloads)
        {
            asset_to_download = downloadQueue[0];
            if (asset_to_download.status == "initialized")
            {
                determine_asset_file_size(asset_to_download);
                asset_to_download.status = "chunked_downloading";
            }
            num_active_chunk_downloads++;
            
            downloadChunk(asset_to_download.num_started_chunks, asset_to_download.num_started_chunks, asset_to_download);
            asset_to_download.num_started_chunks++;
            if (asset_to_download.num_started_chunks == asset_to_download.num_total_chunks)
            {
                downloadQueue.splice(0,1);
            }
            if (num_active_chunk_downloads < max_simultaneous_chunk_downloads)
            {
                scheduleDownloads();
            }
        }
        
    }
    
    //Non-chunked downloads scheduling...
    else
    {
        asset_to_download = downloadQueue[0];
        determine_asset_file_size(asset_to_download);
        asset_to_download.status = "full_downloading";
        downloadQueue.splice(0, 1);
        download_full_file(asset_to_download);
    }
}

//Determines asset file size with HTTP HEAD and calculates the number of chunks...
function determine_asset_file_size(asset_obj)
{
    var file_size_bytes = getFileSize(asset_obj.url);
    var num_chunks = Math.ceil(file_size_bytes / chunk_size_bytes);
    asset_obj.total_size_bytes = file_size_bytes;
    asset_obj.num_total_chunks = num_chunks;
}

function sortBlocks()
{
	//TIMO: tarkistetaan ensin, mitkä korttelit ovat range:n sisällä (tämä sijaintitieto tulee meille periaatteessa tietokannasta, nyt hardkoodattu) ja sortataan ne etäisyysjärjestykseen
	var importantBlocks = new Array (); // Sisältää ne korttelit, jotka ovat R etäisyyden sisällä
	
	var userPosition = {
		x: camera.position.x,
		y: camera.position.z
	};
	//console.log (userPosition); // käyttäjän sijainti
	
	for (i in blocklist){ // Etäisyyden perusteella vertailu ja lisäys importantBlocks -listaan
		var blockDistance = 0;
        curr_block = blocklist[i]
		blockDistance = euclidean (userPosition, curr_block);
		curr_block.distance = blockDistance;
		if (blockDistance <= range) {
            if (curr_block.status == "finished")
                continue;
            //Ei lisätä blockia latausjonoon jos sitä jo ladataan (chunkiton moodi)
            if (curr_block.status == "full_downloading")
                continue;
            
            //Ei lisätä blockia latausjonoon jos sen viimeisiä chunkeja jo ladataan (chunkillinen moodi)
            if (curr_block.status == "chunked_downloading")
            {
                if (curr_block.num_started_chunks == curr_block.num_total_chunks)
                    continue;
            }
			importantBlocks.push(curr_block);
		}
	}
	importantBlocks.sort(function(a, b){return a.distance - b.distance}); // Järjestetään korttelit etäisyyden perusteella järjestykseen
	//console.log (importantBlocks);			
    return importantBlocks;
}

function sortTextureImages()
{
    //TIMO: tarkistetaan ensin, mitkä korttelit ovat range:n sisällä (tämä sijaintitieto tulee meille periaatteessa tietokannasta, nyt hardkoodattu) ja sortataan ne etäisyysjärjestykseen
	var importantTextureImages = new Array (); // Sisältää ne tekstuurikuvat, jotka ovat R etäisyyden sisällä
	
	var userPosition = {
		x: camera.position.x,
		y: camera.position.z
	};
	//console.log (userPosition); // käyttäjän sijainti
	
	for (i in textureimagelist){ // Etäisyyden perusteella vertailu ja lisäys importantBlocks -listaan
		var textureImageDistance = 0;
        curr_textureimage = textureimagelist[i]
		textureImageDistance = euclidean (userPosition, curr_textureimage);
		curr_textureimage.distance = textureImageDistance;
		if (textureImageDistance <= range) {
            if (curr_textureimage.status == "finished")
                continue;
        
            //Ei lisätä tekstuurikuvaa latausjonoon jos sitä jo ladataan (chunkiton moodi)
            if (curr_textureimage.status == "full_downloading")
                continue;
            
            //Ei lisätä tekstuurikuvaa latausjonoon jos sen viimeisiä chunkeja jo ladataan (chunkillinen moodi)
            if (curr_textureimage.status == "chunked_downloading")
            {
                if (curr_textureimage.num_started_chunks == curr_textureimage.num_total_chunks)
                    continue;
            }
			importantTextureImages.push(curr_textureimage);
		}
	}
	importantTextureImages.sort(function(a, b){return a.distance - b.distance}); // Järjestetään korttelit etäisyyden perusteella järjestykseen
	//console.log (importantBlocks);			
    return importantTextureImages;
}

function download_full_file(asset_obj)
{
    var file_url = asset_obj.url;
    console.log(new Date() + " download_full_file() - asset name: " + asset_obj.name + " - URL: " + file_url);
    var xhr = new XMLHttpRequest();
    //Add timestamp to URL to avoid caching...
	xhr.open('GET', file_url + "?" + Date.now(), true);
	xhr.responseType = 'blob';	 
	xhr.onload = function(e) {
        if (this.status == 200) {
            console.log(new Date() + " Asset loading from real URL finished!");
			asset_obj.chunks[0] = this.response;
            asset_obj.status = "finished";
            asset_obj.addToScene();
		}
        scheduleDownloads();
    }
    xhr.send();
}


function downloadChunk(start_chunk_idx, end_chunk_idx, asset_obj) {
    var start_byte_idx = start_chunk_idx * chunk_size_bytes;
    var end_byte_idx = ((end_chunk_idx+1) * chunk_size_bytes) - 1;
  
    var file_url = asset_obj.url;
    console.log(new Date() + " downloadChunk() - asset name: " + asset_obj.name + " - URL: " + file_url + " Chunk (" + (start_chunk_idx+1) + " / " + asset_obj.num_total_chunks + ")");
      //info.append("--> Downloading chunks from " + ase_info.name + " (" + start_chunk_idx + " - " + end_chunk_idx + ")<br><br>");
            
    var xhr = new XMLHttpRequest;
        
    xhr.onload = function(e) {
        if (this.status == 206) { //206 = partial content
            asset_obj.chunks[start_chunk_idx] = this.response;
            asset_obj.num_completed_chunks++;
            if (asset_obj.num_completed_chunks == asset_obj.num_total_chunks)
            {
                asset_obj.status = "finished";
                asset_obj.addToScene();
            }
            num_active_chunk_downloads--;
            scheduleDownloads();
        }
    };
        
    xhr.open("GET", file_url + "?" + Date.now(), true);
    xhr.responseType="blob";
    xhr.setRequestHeader("Range", "bytes=" + start_byte_idx + "-" + end_byte_idx);
    xhr.send();   
}

function handleCompletedChunk(start_chunk_idx, end_chunk_idx, asset_info, chunk_data)
{
	console.log("handleCompeletedChunks "+start_chunk_idx+" .. "
	+end_chunk_idx+" from "+chunk_source_info.name);
  //info.append("<b><== Received chunks [" + start_chunk_idx + "-" + end_chunk_idx + "] from " + chunk_source_info.name + "<br><br></b>");
//         info.append("Payload data:<br>" + chunk_data + "<br>");        
  chunked_asset_data[start_chunk_idx] = chunk_data;
  num_completed_chunks += (end_chunk_idx+1 - start_chunk_idx);
  chunk_source_info.downloading = false;
  if (chunk_source_info.name == "ASE") {
    num_active_ASE_downloads -=1;
  } else {
    num_active_peer_downloads -=1;
  }
  scheduleChunkDownloads();
}

function getFileSize(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("HEAD", url, false);
  xhr.send();
  return parseInt(xhr.getResponseHeader("Content-Length"));
}

/*ArtosNotes: Blokin JSONin päärakenne:
object, type "Scene"
	-> children [
					{
						rakennusta kuvaava lapsiobjekti
						type: "Mesh"
						uuid: itse_rakennuksen_UUID
						material: materiaalin_UUID
						geometry: geometrian_UUID
					}
				]
materials [
	{
		yhden rakennuksen materiaalia kuvaava objekti
		uuid: itse_materiaalin_UUID
		map: textuurin_UUID
	}
]
geometries [...]
textures [
	{
		tekstuuria kuvaava objekti
		uuid: itse_tekstuurin_UUID
		image: imagen_UUID
	}
]
images
[
	{
		imagea kuvaava objekti
		uuid: itse_imagen_uuid
		url: kuvan URLi!
	}
]
*/



// Converts from degrees to radians.
Math.radians = function(degrees) {
  return degrees * Math.PI / 180;
};
 
// Converts from radians to degrees.
Math.degrees = function(radians) {
  return radians * 180 / Math.PI;
};

/*
function loadMultipleBlocks(location){
	var blocklocation = new Object();
	toLoad = [];	
	
	for (i in blocklist){
		blockLocation = {x:blocklist[i].x, y:blocklist[i].y};
		if (blocklist[i].name === 'a5') {
		} 
		if (euclidean(location, blockLocation) <= 150 && blocklist[i].loaded === false){ //use knn here later
			loadSingleBlock(blocklist[i]);
		}
		else if (euclidean(location, blockLocation) >= 149 && blocklist[i].loaded === true) {
			removeSingleBlock(blocklist[i]);
			blocklist[i].loaded = false;
		}		
	}
}
*/

//jos tarvii poistella
function removeSingleBlock(block){
	var toRemove = scene.getObjectByName(block.name);
	scene.remove(toRemove);
}

//tätäkin voi käyttää tarvittaessa
function addModelToScene(obj, offsetX, offsetY, name) {
	var obu = new THREE.Object3D();
	obu = obj;
	obj.translateX(offsetX);
	obj.translateZ(offsetY);
	obj.name = name;
	scene.add(obj);
	// TÄSSÄ YHTEYDESSÄ PITÄÄ OTTAA OBJEKTIN "TIEDOT" TALTEEN, ETTÄ PELKÄLLE GEOMETRIALLE VOIDAAN MYÖHEMMIN LISÄTÄ MATERIAALI L. KUVA
}

function euclidean(p,q){
	return Math.sqrt(Math.pow((q.x-p.x),2) + (Math.pow((q.y-p.y),2)));
}

//tämä sorttaa kaikki talot erikseen
function distanceToObjects(origin){
	distances = []
	for (object in allObjects){
		destination = {x: allObjects[object].x, y: allObjects[object].z};
		distance = euclidean(origin,destination);
		distances.push([object, distance]);
	}
	distances.sort(function(a,b){return a[1]-b[1]});
	//console.log(distances);
	return distances;
}


function init() {
	//alussa valaistus- ja kamera-asioita
    //var clock = new THREE.Clock();

    stats = initStats();

    // create a scene, that will hold all our elements such as objects, cameras and lights.
    //var scene = new THREE.Scene();

    // create a camera, which defines where we're looking at.
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 8000);


    // create a render and set the size
    webGLRenderer = new THREE.WebGLRenderer();
    //webGLRenderer.setClearColor(new THREE.Color(0x000, 1.0));
	webGLRenderer.setClearColor(new THREE.Color(0x4d4d4d, 1.0));
    webGLRenderer.setSize(window.innerWidth, window.innerHeight);
    webGLRenderer.shadowMapEnabled = true;

    // position and point the camera to the center of the scene
    camera.position.x = 60;
    camera.position.y = 2;
    camera.position.z = 0;
    camera.lookAt(new THREE.Vector3(0, 0, 0));


    camControls = new THREE.FirstPersonControls(camera);
    camControls.lookSpeed = 0.1;
    camControls.movementSpeed = 20;
    camControls.noFly = true;
    camControls.lookVertical = true;
    camControls.constrainVertical = true;
    camControls.verticalMin = 1.0;
    camControls.verticalMax = 2.0;
	//camControls.verticalMax = 1.0;
    camControls.lon = -150;
    camControls.lat = 120;


    //var ambientLight = new THREE.AmbientLight(0x383838);
	var ambientLight = new THREE.AmbientLight(0xFFFFFF);
	ambientLight.intensity = 0.8;
    scene.add(ambientLight);

    // add spotlight for the shadows
    var spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(100, 140, 130);
    spotLight.intensity = 2;
    scene.add(spotLight);

    // add the output of the renderer to the html element
    document.getElementById("WebGL-output").appendChild(webGLRenderer.domElement);

    // call the render function
    var step = 0;

    //console.log(scene.children);

    // setup the control gui
    var controls = new function () {
        // we need the first child, since it's a multimaterial


    };

	//Printtaillaan oma sijainti
    var gui = new dat.GUI();

	var userX = new Object();
	var userZ = new Object();
	userX.positionX = camera.position.x;
	userZ.positionZ = camera.position.z;
	gui.add(userX, 'positionX').listen();
	gui.add(userZ, 'positionZ').listen();
    var mesh;

    //console.log(scene.children);	

    function setCamControls() {

    }

	//referenssicube alussa, että tietää miten päin itse ollaan
	debugcube = new THREE.Mesh( new THREE.CubeGeometry( 20, 20, 20 ), new THREE.MeshNormalMaterial() );
	debugcube.position = [0,0,0];
	scene.add(debugcube)
	//addModelToScene(debugcube);


	// TIMO
	// Tässä pitäisi lähteä jatkuvasti pyörivä latausten hallintalooppilooppi käyntiin, joka t sekunnin/liikutun etäisyyden välein tarkastaa, mitä pitäisi ladata (etäisyys + latausprosentti) + mahdolliset latausten jatkot ja keskeytykset
	
	//1. tarkistetaan käynnissä olevat lataukset
	//1.1. pausetetaan niistä ne, jotka ovat rangen ulkopuolella
	//2. tarkistetaan alueella olevat laataamattomat (1) korttelit (JSON) ja (2) rakennukset (tekstuuri)
	//2.1. laitetaan järjestykseen
	  
	//prioritizeBlocks();
    
    
    setInterval(updateDownloadQueue, update_download_queue_interval_ms);
    updateDownloadQueue();
	
	scheduleDownloads();
    render();
	//console.log (blockData);
	//prioritizeBuildings(blockData);
}

	//TIMO: uusi
function prioritizeBlocks () {
	//TIMO: tarkistetaan ensin, mitkä korttelit ovat range:n sisällä (tämä sijaintitieto tulee meille periaatteessa tietokannasta, nyt hardkoodattu) ja sortataan ne etäisyysjärjestykseen
	var importantBlocks = new Array (); // Sisältää ne korttelit, jotka ovat R etäisyyden sisällä
	
	var userPosition = {
		x: camera.position.x,
		y: camera.position.z
	};
	//console.log (userPosition); // käyttäjän sijainti
	
	for (i in blocklist){ // Etäisyyden perusteella vertailu ja lisäys importantBlocks -listaan
		var blockDistance = 0;
		blockDistance = euclidean (userPosition, blocklist[i]);
		blocklist[i].distance = blockDistance;
		if (blockDistance <= range) {
			importantBlocks.push(blocklist[i]);
		}
	}
	importantBlocks.sort(function(a, b){return a.distance - b.distance}); // Järjestetään korttelit etäisyyden perusteella järjestykseen
	//console.log (importantBlocks);			

	//TIMO: tarkistetaan, onko kortteleita jo ladattu ja jos ei ole, niin aloitetaan kortteleiden lataus lähimpänä olevasta
	
	for (i in importantBlocks) {
		//if (importantBlocks[i].loaded == false) {
			downloadQueue.push (importantBlocks[i]);
		//}
	}
	if (downloadQueue.length == 0) {
		// SIIRRY TEKSTUURIEN LATAAMISEEN
	}
	else { // TIMO: tästä puuttuu vielä latausmekanismit, lataa nyt vain lähinnä olevan korttelin
		//MATTI: aletaan hackaaminen ja ladataan testiblokki muuttujaan threen oman latauskoodin sijaan. Täten saadaan pelkät geometriat ilman tekstuureja. Tätä samaa blokkia toistetaan loputtomiin.
		var scenejson = (function() {
			var scenejson = null;
			$.ajax({
				'async': false,
				'global': false,
				'url': importantBlocks[0].url, 
				'dataType': "json",
				'success': function (data) {
					scenejson = data;
				}
			});
			return scenejson;
		})();
		//console.log (scenejson);
		//return scenejson;
	}
	//Otetaan JSONista korttelin kaikki tekstuurit, geometriat, materiaalit jne. omiksi muuttujikseen 
	var textureLoader = new THREE.TextureLoader();
	var loader = new THREE.JSONLoader();
	var material;
	var material2;
	var geometry;
	var geometry2;
	var matrix;
	var url;
	var map;
	
	blockImages = scenejson.images;
	blockMaterials = scenejson.materials;
	blockObjects = scenejson.object;
	blockGeometries = scenejson.geometries; 
	blockTextures = scenejson.textures;	
	
	// Tässä luodaan buildingLocations -lista, johon sijoitetaan jokaisen talon koordinaatit
	blockLocation = {x:importantBlocks[0].x, y:importantBlocks[0].y};
	/*for (o in blockObjects.children){
		var objectx = blockObjects.children[o].matrix[12] + blockLocation['x']
		var objectz = blockObjects.children[o].matrix[13] + blockLocation['y']
			
		buildingList[blockObjects.children[o].geometry] = {x: objectx, z: objectz, blockname: blocklist[i].name, buildingname: blockObjects.children[o].name}
	}
	*/
	//console.log (blockObjects);
	
	
	//Luodaan pelkkä harmaa väliaikainen materiaali
	material = new THREE.MeshLambertMaterial( {
		color: 0xD4DED7,
	} );
	
	// Tässä lisätään 3D maailmaan ko. korttelin kaikki geometria ja otetaan materiaalit URL:t talteen
	for (i in blockObjects.children){
		//console.log (blockObjects.children[i]);
		geometryuuid = blockObjects.children[i].geometry;
		materialuuid = blockObjects.children[i].material;
	
		for (g in blockGeometries){ // Geometrian käsittely
			if (geometryuuid === blockGeometries[g].uuid){
				geometry2 = loader.parse(blockGeometries[g].data, url);
				matrix = blockObjects.children[i].matrix;
			}
			if (geometry2 != undefined){
			newob = new THREE.Mesh(geometry2.geometry, material); // Miten tähän geometriaan saadaan myöhemmin päivitettyä materiaalit, kun niitä ei vielä tässä vaiheessa anneta?
			var x = importantBlocks[0].x;
			var y = importantBlocks[0].y;
						
			newob.translateOnAxis(new THREE.Vector3(1,0,0), x);
			newob.translateOnAxis(new THREE.Vector3(0,0,1), y);
			
			newob.translateOnAxis(new THREE.Vector3(1,0,0), matrix[12]);
			newob.translateOnAxis(new THREE.Vector3(0,0,-1), matrix[13]);			
			
			var objectx = blockObjects.children[i].matrix[12] + blockLocation['x'];
			var objectz = blockObjects.children[i].matrix[13] + blockLocation['y'];
			
			buildingList[geometryuuid] = {x: objectx, z: objectz, objectID: newob.id};
			
			scene.add(newob);
			console.log (buildingList);
			}
		}
		for (m in blockMaterials){ // Tekstuurien käsittely
			if (materialuuid === blockMaterials[m].uuid){
				textureuuid = blockMaterials[m].map
				for (t in blockTextures){
					if (textureuuid === blockTextures[t].uuid){
						imageuuid = blockTextures[t].image
						for (b in blockImages){
							if (imageuuid === blockImages[b].uuid){
								url = 'resources/' + blockImages[b].url;
								buildingList[geometryuuid]["TextureUrl"] = url; 
							}
						}
					}
				}
			}
		}
	}	
	// TIMO: tilapäinen render -toiminnallisuus
	stats.update();
	var delta = clock.getDelta();

	camControls.update(delta);
	webGLRenderer.clear();
	requestAnimationFrame(render);
	webGLRenderer.render(scene, camera);

	//console.log (buildingList);
	var xhr = new XMLHttpRequest();
	xhr.open('GET', buildingList["0CFDFFFA-FCCE-3A23-AB65-A355F7817B80"]["TextureUrl"] + "?" + Date.now(), true);
	xhr.responseType = 'blob';	 
	xhr.onload = function(e) {
        if (this.status == 200) {
            console.log(new Date() + " Texture loading from real URL finished!");
		// get binary data as a response
			console.log(typeof(this.response));
		   building_texture_blob = this.response;
           blob_url = URL.createObjectURL(building_texture_blob);
           console.log(new Date() + " Loading texture from blob object url: " + blob_url);
		   map = textureLoader.load(blob_url);
           console.log(new Date() + " Texture loading from blob object URL finished!");
			console.log(map);
	//Tässä tehdään materiaali joka käyttää ko. tekstuuria. Ehkä tähän voi tehdä myöhemmin jonkun if/elsen joka tekee materiaalin ilman tekstuuritiedostoa ennen kuin tekstuuri on ladattu
		material2 = new THREE.MeshPhongMaterial( {
            color: 0xaaaaaa,
            specular: 0x222222,
            shininess: 1,
            map: map
		} );	
	
        test_id = buildingList["0CFDFFFA-FCCE-3A23-AB65-A355F7817B80"]["objectID"];
        console.log(test_id);
        scene.getObjectById(test_id).material = material2;
		   
		   
	  }
	};
	console.log(new Date() + " Loading texture from real URL: " + buildingList["0CFDFFFA-FCCE-3A23-AB65-A355F7817B80"]["TextureUrl"]); 
	xhr.send();
	/*	
	//map = textureLoader.load(buildingList["0CFDFFFA-FCCE-3A23-AB65-A355F7817B80"]["TextureUrl"]); //HUOM tässä kohtaa ladataan tekstuuri! Tähän tulee sitten joku kutsu joka korvaa tämän.
	map = textureLoader.load(URL.createObjectURL(building_texture_blob));
	console.log(map);
	//Tässä tehdään materiaali joka käyttää ko. tekstuuria. Ehkä tähän voi tehdä myöhemmin jonkun if/elsen joka tekee materiaalin ilman tekstuuritiedostoa ennen kuin tekstuuri on ladattu
		material2 = new THREE.MeshPhongMaterial( {
		color: 0xaaaaaa,
		specular: 0x222222,
		shininess: 1,
		map: map
		} );	
	
	test_id = buildingList["0CFDFFFA-FCCE-3A23-AB65-A355F7817B80"]["objectID"];
	console.log(test_id);
	scene.getObjectById(test_id).material = material2;
    */
}

//TIMO: uusi
/*function prioritizeBuildings(scenejson) {

}*/
	
function render() {

	stats.update();
	var delta = clock.getDelta();

	camControls.update(delta);
	webGLRenderer.clear();
/*		userX.positionX = camera.position.x;
	userZ.positionZ = camera.position.z;
	userloc = {x:userX.positionX, y:userZ.positionZ};
	sortcounter++;
	if (sortcounter === 300){ //Tässä sortataan objektit ja ladataan!
		objectdistances = distanceToObjects(userloc);
		newBlockLoader(objectdistances);
		//sortcounter = 0;
		//console.log(scene);
	}*/		
	requestAnimationFrame(render);
	webGLRenderer.render(scene, camera)
}

//Tämä funktio ottaa vastaan listan objektireferenssejä jotka on sortattu etäisyysjärjestykseen -> TÄSTÄ PITÄÄ OTTAA VIELÄ TALTEEN TEKSTUURIEN LATAUS!!
/*function newBlockLoader(objectlist){
	var textureLoader = new THREE.TextureLoader();
	var loader = new THREE.JSONLoader();
	var geometry;
	var geometry2;
	var material;
	var matrix;
	var threematrix = new THREE.Matrix4;
	var url;
	var map;
	var url;
	var block;
	var gayloader = new THREE.ObjectLoader();
	var fakeJSON = {};
	
	//Tämä for-helvetti käy läpi blokin jsonin siten, että saadaan talo erillisenä objektina
	for (o in objectlist){
		var name = allObjects[objectlist[o][0]].buildingname;
		block = allObjects[objectlist[o][0]].blockname;
		for (i in blockObjects.children){
			if (blockObjects.children[i].name === name){
				fakeJSON['object'] = blockObjects.children[i]; 
				geometryuuid = blockObjects.children[i].geometry
				materialuuid = blockObjects.children[i].material
				for (m in blockMaterials){
					if (materialuuid === blockMaterials[m].uuid){
						fakeJSON['object']['materials'] = blockMaterials[m]; 
						textureuuid = blockMaterials[m].map
						for (t in blockTextures){
							if (textureuuid === blockTextures[t].uuid){
								fakeJSON['object']['textures'] = blockTextures[t]; 
								imageuuid = blockTextures[t].image
								for (b in blockImages){
									if (imageuuid === blockImages[b].uuid){
										fakeJSON['object']['images'] = blockImages[b];
										url = 'resources/' + blockImages[b].url;
									}
								}
							}
						}
					}
				}
				for (g in blockGeometries){
					if (geometryuuid === blockGeometries[g].uuid){
						fakeJSON['object']['geometries'] = blockGeometries[g];
						geometry2 = loader.parse(blockGeometries[g].data, url);
						matrix = blockObjects.children[i].matrix;

					}
				}
				
				
			}
		}
		map = textureLoader.load( url ); //HUOM tässä kohtaa ladataan tekstuuri! Tähän tulee sitten joku kutsu joka korvaa tämän.

		//Tässä tehdään materiaali joka käyttää ko. tekstuuria. Ehkä tähän voi tehdä myöhemmin jonkun if/elsen joka tekee materiaalin ilman tekstuuritiedostoa ennen kuin tekstuuri on ladattu
		material = new THREE.MeshPhongMaterial( {
		color: 0xffffff,
		specular: 0x222222,
		shininess: 25,
		map: map
		} );
		
		flagHere = true; //tämä oli muistaakseni jotain testailuja varten, voi varmaan poistaa
		if (geometry2 != undefined && flagHere === true){
			newob = new THREE.Mesh(geometry2.geometry, material);
			

			var x;
			var y;
			for (f in blocklist){
				if (blocklist[f].name === block){
					x = blocklist[f].x
					y = blocklist[f].y
				}	
			}
						
			newob.translateOnAxis(new THREE.Vector3(1,0,0), x)
			newob.translateOnAxis(new THREE.Vector3(0,0,1), y)
			
			newob.translateOnAxis(new THREE.Vector3(1,0,0), matrix[12])
			newob.translateOnAxis(new THREE.Vector3(0,0,-1), matrix[13])			
			
			scene.add(newob);
			
			//debugcube = new THREE.Mesh( new THREE.CubeGeometry( 20, 20, 20 ), new THREE.MeshNormalMaterial() );
			//addModelToScene(debugcube, x,y, 'debugcube');

		}
	}
}*/

	
/*	setTimeout(function(){
	  //your code to be executed after 1 seconds
	    scene.traverse(function(e) {
			if (e instanceof THREE.Mesh ) {
			//console.log(e)	
			e.geometry.computeFaceNormals();
			e.geometry.computeVertexNormals(); 
		}
		});
	}, 8000); 
*/



function initStats() {

	var stats = new Stats();
	//console.log(stats);
	stats.setMode(0); // 0: fps, 1: ms

	// Align top-left
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.left = '0px';
	stats.domElement.style.top = '0px';

	document.getElementById("Stats-output").appendChild(stats.domElement);

	return stats;
}
window.onload = init;