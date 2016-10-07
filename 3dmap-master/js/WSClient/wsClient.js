var connection = null;
var subscriptions = new Array();
var clientId = -1;
var eventIds = new Array();
var eventQueue = new Array();

//var waitingForResponse = false;


$(function(){
    //close any websocket connections before user leaves page
    $(window).on('beforeunload', function(){
      if(connection){
        connection.send(JSON.stringify({type:"close", id: clientId}));
        connection.close();

      }
      weatherClient.close();
    });
});



///////////////////////////////////////////////////////////////
// Meta methods for WEBSOCKET
///////////////////////////////////////////////////////////////

function updateDatasources(name, minX, minY, maxX, maxY){
    if($.inArray(name, subscriptions) == -1) {
        subscriptions.push(name);
        connection.send(JSON.stringify({id: clientId, type:'setup', subscriptions: subscriptions, minX:minX, minY:minY, maxX: maxX, maxY:maxY, noOfBuildings: noOfBuildings}))
    } else {
        subscriptions.splice($.inArray(name, subscriptions), 1);
        connection.send(JSON.stringify({id: clientId, type:'setup', subscriptions: subscriptions, minX:minX, minY:minY, maxX: maxX, maxY:maxY, noOfBuildings: noOfBuildings}))
        //remove events from screen
        if(name=="buildingEnergy"){
            setTimeout(function(){
                dataVisualisation.resetAllBuildings();
            }, 5000);

        }else{
            setTimeout(function(){
                dataVisualisation.removeAllTypedEvents(name);
            }, 5000);

        }
    }
    console.log(JSON.stringify({type:"setup", id: clientId, subscriptions: subscriptions, minX:minX, minY:minY, maxX: maxX, maxY:maxY, noOfBuildings: noOfBuildings}));

}

///////////////////////////////////////////////////////////////
// WEBSOCKET PART
///////////////////////////////////////////////////////////////

// If window is not in focus, it stores all incoming events untill window has focus again
// When window gets focus, it calls "handleDelayedEvent" and pops the first event in the
// queue, until no more events are in the queue.

var delayedEventTime = 1000;
function handleDelayedEvent() {
    if(window.blurred == true) return;
    handleMessage(eventQueue.pop());
    if(eventQueue.length > 0)
        setTimeout(handleDelayedEvent, delayedEventTime);
}


window.onblur = function() { window.blurred = true; };
window.onfocus = function() {
    if(eventQueue.length > 0)
    setTimeout(function() {
        setTimeout(handleDelayedEvent, delayedEventTime);
    }, delayedEventTime);
    window.blurred = false;
};

function setupSocket() {

    // if user is running mozilla then use it's built-in WebSocket
	  window.WebSocket = window.WebSocket || window.MozWebSocket;

    // open connection
    var hostname = window.location.hostname;
    hostname = hostname.replace('3dmap.','3dmap-server.');
    var url = 'ws://'+ hostname + ':8001';
    connection = new WebSocket(url);

    connection.onopen = function () {
        // Send flagged subscribtions
    	//connection.send(JSON.stringify({type: "SETUP", data: {value : maxBuildings}}));
    };

    // most important part - incoming messages
    connection.onmessage = function (message) {
       // console.log(message);

        var msg = JSON.parse(message.data);
        if(msg.eventType===undefined){
            console.log(message);
        }
       // console.log(msg);

        if(msg.type != null && msg.type == "setup") {
            clientId = msg.id;
        } else {
            if(window.blurred) {
                eventQueue.push(msg);
            } else {
		//console.log("will handle message!");
                handleMessage(msg);
            }
        }

    };
}

function handleMessage(msg) {

    let coordinates = {lat:msg.lat, lng:msg.long};

    if($.inArray(msg.eventId, eventIds) == -1 && msg.severityLevel != -1) { // If event is new and not to be deleted
        eventIds.push(msg.eventId);

    	console.log("handleMessage -> lat: "+msg.lat+" long: "+msg.long+" eventId: "+msg.eventId+" eventType: "+msg.eventType+" severity: "+msg.severityLevel);


        if(msg.eventType==='buildingEnergy'){
            //dataVisualisation.showBuildingEnergy(coordinates, msg.severityLevel);
            //using demoServer, we need this hack
            dataVisualisation.changeBuild(msg.severityLevel,msg.targetBuildingId);
        }else{
            dataVisualisation.showEventByCoords(coordinates, msg.eventId, msg.eventType, msg.severityLevel);
        }


    } else if($.inArray(msg.eventId, eventIds) != -1 && msg.severityLevel != -1) { // If event is not new and not to be deleted
        if(msg.eventType==='buildingEnergy'){
            //dataVisualisation.showBuildingEnergy(coordinates, msg.severityLevel);
            //using demoServer, we need this hack
            dataVisualisation.changeBuild(msg.severityLevel,msg.targetBuildingId);
        }else{
            dataVisualisation.updateEvent(msg.eventId, msg.severityLevel);
        }

    } else if($.inArray(msg.eventId, eventIds) != -1 && msg.severityLevel == -1) { // If event is not new and to be deleted
        if(msg.eventType==='buildingEnergy'){
            //dataVisualisation.resetBuildingEnergy(coordinates);
            //using demoServer, we need this hack
            dataVisualisation.changeBuild(1,msg.targetBuildingId);
        }else{
            console.log(msg.eventType);
            dataVisualisation.removeEvent(msg.eventId);
        }

    }
}



var weatherClient = (function(){
    var hostname = window.location.hostname;
    hostname = hostname.replace('3dmap.','3dmap-server.');
    var url = 'ws://'+ hostname + ':8002';
    //var connection;
    var clientId = -1;
    var connection = new WebSocket(url);
    var weatherCallbackFunc;
    var timeCallbackFunc;
    connection.onmessage = function(message) {
        var msg = JSON.parse(message.data);
        if(msg.type=='setup'){
            console.log("got new ID: " +msg.id);

            clientId = msg.id;

        }else if(msg.type=='timeInfo'){
            console.log("got time info");
            if(timeCallbackFunc){
                timeCallbackFunc(msg);
            }

        }else{
            console.log("receiving weather data for: "+msg.city+": "+msg.weatherType+" of severity:"+msg.severityLevel);
            var weatherType = msg.weatherType;
            var weatherSeverity = msg.severityLevel;
            if(weatherCallbackFunc){
                weatherCallbackFunc(weatherType,weatherSeverity);
            }
        }

    };


    return {
        setup: function(city, weatherCallback, timeCallback){
            if(connection && connection.readyState==1){
                console.log(connection);
                weatherCallbackFunc = weatherCallback;
                timeCallbackFunc = timeCallback;
                connection.send(JSON.stringify({type: "SETUP", data: {city : city},id:clientId}));
            }
        },

        close: function(){
            if(connection){
                connection.send(JSON.stringify({type:"close", id: clientId}));
                connection.close();
            }
        }
    }

})();
