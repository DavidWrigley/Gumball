//step 1) require the modules we need
var http = require('http'); //helps with http methods
var path = require('path'); //helps with file paths
var fs = require('fs'); //helps with file system tasks
var querystring = require('querystring');
var redis = require('redis');
var client = redis.createClient(null,"winter.ceit.uq.edu.au");

var rfidTag = '';
var OK = 0;
var i = 0;
var Result = "hue";
var ready = 0;

// connect to db 10
client.select(10, function() {
    console.log("redis connected on 10 (i think)");
});

// print errors if they occur
client.on("error", function(err) {
    console.log("Redis Error:" + err);
});

function check(current, full, callback) {
    console.log("cheking current: " + current + " vs Full: " + full);
    if(current == full) {
        callback(1)
    }
}

function getFromHash(hash, subhash, callback) {
    client.hget(hash, subhash, function(err,obj2) {
        if(obj2 != null) {
            console.log("getFromHash: " + obj2);
            callback(obj2,hash);
        } else {
            callback("0",hash);
        }
    });
}

function getFullList(list, callback) {
    client.lrange(list, 0, -1, function(err,obj) {
        if(obj != null) {
            console.log("getFullList: " + obj);
            callback(obj);
        } else {
            callback("0");
        }
    });
}

function servError(req, res, thing, errorMessage, advice) {
    var content = '';
    var fileName = "/error.html"; //the file that was requested
    var localFolder = __dirname + '/public';//where our public files are located

    // the rfid tag does not exist.
    res.writeHead(200, "OK", {'Content-Type': 'text/html'});

    content = localFolder + fileName;

    fs.readFile(content,function(err,contents){
        if(!err){
            // fiddle the data
            var final = '';
            final = contents.toString()

            // replace data
            final = final.replace("%THING%", thing);
            final = final.replace("%ERRORMESSAGE%", errorMessage);
            final = final.replace("%ADVICE%", advice);
            
            // send the data
            res.end(final);
        } else {
            console.log("Something went wrong serving error page");
        }
    });
}

function servPage(pageaddr, req, res, decode, rfidTag) {
    var content = '';
    var fileName = pageaddr; //the file that was requested
    var localFolder = __dirname + '/public';//where our public files are located

    // the rfid tag does not exist.
    res.writeHead(200, "OK", {'Content-Type': 'text/html'});

    content = localFolder + fileName;

    fs.readFile(content,function(err,contents){
        if(!err){
            if(fileName == "/userdata.html") {
                // fiddle the data
                var final = '';
                final = contents.toString(); 

                // check all registered cards
                getFullList("Registered", function(listArray){
                    if(listArray == "0") {
                        // serveerror page
                        servError(req, res, "The List returned was:", "NULL ", "This could be a redis issue or there are no registered users");
                    } else {
                        // nothing wrong
                        for(var l = 0; l < listArray.length; l++) {
                            console.log("Registered User[" + l +"]: " +listArray[l]);
                            // get there first name
                            getFromHash(listArray[l], "First", function(Result,tempid){
                                console.log("Result Value: "+ Result + " for: " + tempid);
                                
                                // does it match?
                                if(Result == decode.checkName) {
                                    console.log("match");

                                    // set all the user entered data into the details page
                                    getFromHash(tempid, "First", function(Result) {
                                        final = final.replace("%FIRSTNAME%", Result);
                                    });
                                    
                                    getFromHash(tempid, "Last", function(Result) {
                                        final = final.replace("%LASTNAME%", Result);
                                    });
                                    
                                    getFromHash(tempid, "Email", function(Result) {
                                        final = final.replace("%EMAIL%", Result);
                                    });

                                    getFromHash(tempid, "RFID", function(Result) {
                                        final = final.replace("%CARDRFID%", Result); 
                                    });

                                    getFromHash(tempid, "Human Time", function(Result) {
                                        final = final.replace("%TIME%", Result);
                                    });

                                    getFromHash(tempid, "Lollies", function(Result){
                                        if(Result == "1") {
                                            final = final.replace("%LOLLIES%", "Yes, Party Time!!!");
                                        } else {
                                            final = final.replace("%LOLLIES%", "No, Sad Panda!");
                                        }
                                        res.end(final);
                                        return;
                                    });
                                }
                            });   
                        }
                        // need to check if there was no match.
                    }
                });
            // will be used for managment of the system.
            } else {
                res.end(contents);
            }
        } else {
            console.log("Issues serving " + fileName);
            //otherwise, let us inspect the eror
            //in the console
            console.dir(err);

            //if the file was not found, set a 404 header...
            res.writeHead(404, {'Content-Type': 'text/html'});
            //send a custom 'file not found' message
            //and then close the request
            res.end('<h1>Sorry, the page you are looking for cannot be found.</h1>');
        }
    });
}
 
//a helper function to handle HTTP requests
function requestHandler(req, res) {
    var content = '';
    //var fileName = path.basename(req.url); //the file that was requested
    var fileName = path.normalize(req.url); //the file that was requested
    //var localFolder = __dirname + '/public/';//where our public files are located
    var localFolder = __dirname + '/public';//where our public files are located


    //NOTE: __dirname returns the root folder that
    //this javascript file is in.
    if(req.method == "GET") {
        console.log("GET request for: " + req.url);
        if(fileName === '/form.html') {
            content = localFolder + fileName;//setup the file name to be returned
     
            //reads the file referenced by 'content'
            //and then calls the anonymous function we pass in
            fs.readFile(content,function(err,contents){
                //if the fileRead was successful...
                if(!err){
                    // send the data
                    res.end(contents);
                } else {
                    //otherwise, let us inspect the eror
                    //in the console
                    console.dir(err);
                };
            });
        } else if(fileName == "/manage.html") {
            content = localFolder + fileName;
            fs.readFile(content,function(err,contents){
                //if the fileRead was successful...
                if(!err){
                    // send the data
                    // fiddle the data
                    var final = '';
                    var managedata = "";
                    var listArray = [];
                    final = contents.toString(); 
                    console.log("entering managemode!");

                    // check all registered cards
                    getFullList("Registered", function(listArray){
                        ready = 0;
                        if(listArray == "0") {
                            // throw error
                            ready = 1;
                        } else {
                            // nothing wrong
                            var datcheck = 0;
                            for(var l = 0; l < listArray.length; l++) {
                                console.log("Registered User[" + l +"]: " +listArray[l]);
                                // get there first name
                                getFromHash(listArray[l], "First", function(Result,tempid){
                                    // add number
                                    var datstring = ""
                                    datstring = ("" + tempid.toString() + " : " + Result.toString());
                                    managedata = managedata += datstring;
                                    managedata = managedata += "<br>";
                                    datcheck += 1;
                                    check(datcheck,listArray.length,function(Hue) {
                                        console.log(managedata);
                                        final = final.replace("%REGISTEREDUSER%", managedata);
                                        res.end(final);
                                    });
                                });
                            }
                        }
                    });
                    //managedata = "Hello";
                } else {
                    //otherwise, let us inspect the eror
                    //in the console
                    console.dir(err);
                };
            });
        } else if(fileName == "/reset.html") {
            fileName = "/index.html";
            content = localFolder + fileName;//setup the file name to be returned

            client.del("Unregistered", redis.print);
            
            client.lrange("Registered", 0, -1, function(err,obj) {
                if(obj != null) {
                    for(i = 0; i < obj.length; i++) {
                        console.log("Registered Users[" + i +"]: " + obj[i]);
                        client.del(obj[i], redis.print);
                        console.log("Deleted");
                    }
                }
            });

            client.del("Registered", redis.print);

            client.set("Number", 0, redis.print);

     
            //reads the file referenced by 'content'
            //and then calls the anonymous function we pass in
            fs.readFile(content,function(err,contents){
                //if the fileRead was successful...
                if(!err){
                    // send the data
                    res.end(contents);
                } else {
                    //otherwise, let us inspect the eror
                    //in the console
                    console.dir(err);
                };
            });
        } else {
            // any other file
            content = localFolder + fileName;//setup the file name to be returned
     
            //reads the file referenced by 'content'
            //and then calls the anonymous function we pass in
            fs.readFile(content,function(err,contents){
                //if the fileRead was successful...
                if(!err){
                    //send the contents of index.html
                    //and then close the request
                    res.end(contents);
                } else {
                    //otherwise, let us inspect the eror
                    //in the console
                    console.dir(err);

                    //if the file was not found, set a 404 header...
                    res.writeHead(404, {'Content-Type': 'text/html'});
                    //send a custom 'file not found' message
                    //and then close the request
                    res.end('<h1>Sorry, the page you are looking for cannot be found.</h1>');
                };
            });
        }
    } else if(req.method == "POST") {
        // log the information, to make sure its working
        console.log("POST request from: " + req.url);

        if(req.url == "/registerSubmit.html") {

            var fullBody = '';

            req.on('data', function(data) {
                fullBody += data.toString();
            });

            req.on('end', function() {
                // node side
                console.log(fullBody + "<--- post data");

                // decode
                var decode = querystring.parse(fullBody);

                // check the data
                console.log(decode.key + "<=== Key");
                console.log(decode.firstName + "<--- First Name");
                console.log(decode.lastName + "<--- Last Name");
                console.log(decode.email + "<--- Email");
                console.log(decode.lollies + "<--- Lollies");

                // organise the redis data here
                client.hget("Unregistered", decode.key.toString(), function(err,obj) {
                    // will get the rfid
                    rfidTag = obj;
                    if(rfidTag != null) {
                        console.log("Registering: " + rfidTag);
                        // set the RFID tag
                        client.hset(rfidTag, "RFID", rfidTag, redis.print);
                        // set the name.
                        client.hset(rfidTag, "First", decode.firstName, redis.print);
                        // set the last name
                        client.hset(rfidTag, "Last", decode.lastName, redis.print);
                        // set the email
                        client.hset(rfidTag, "Email", decode.email, redis.print);
                        // set the lollies
                        if(decode.lollies == "lollies") {
                            client.hset(rfidTag, "Lollies", "1", redis.print);
                        } else {
                            client.hset(rfidTag, "Lollies", "0", redis.print);
                        }

                        // delete the hash key in unregistered
                        client.hdel("Unregistered", decode.key.toString(), redis.print);

                        // add to the registered list of cards
                        client.lpush("Registered", rfidTag, redis.print);

                        // serve up the completion page
                        servPage("/registerSubmit.html", req, res, decode, rfidTag);
                    }
                    else {
                        var thing = "";
                        thing = thing + "The Card Code: \"" + decode.key + "\": "
                        servError(req, res, thing, "Does not exist in \"Unregistered\" Cards", "Scan again to check your Card Code, You may also already be Registered");
                    }
                });
            });
        } else if(req.url == "/userdata.html") {
            var fullBody = '';

            req.on('data', function(data) {
                fullBody += data.toString();
            });

            req.on('end', function() {
                // node side
                console.log(fullBody + "<--- post data");

                // decode
                var decode = querystring.parse(fullBody);

                // serv responce
                servPage("/userdata.html", req, res, decode, rfidTag)
            });
        }
    };
};
 
console.log("starting server on 3000");
//step 2) create the server
http.createServer(requestHandler)
 
//step 3) listen for an HTTP request on port 3000
.listen(55671);

console.log("started");
