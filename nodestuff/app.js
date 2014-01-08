var http = require('http');
var path = require('path');
var fs = require('fs');
var querystring = require('querystring');
var redis = require('redis');
var client = redis.createClient(null,"winter.ceit.uq.edu.au");

var rfidTag = '';
var OK = 0;
var i = 0;
var Result = "hue";
var ready = 0;
var port = 55671;
var userFound = 0;
var finishedString = "";

// connect to db 10
client.select(10, function() {
    console.log("redis connected on 10");
});

// print errors if they occur
client.on("error", function(err) {
    console.log("Redis Error:" + err);
});

/**********
    function that hunts for the users in the registered redis datadase
    returns an array, that can hold more then one user, this needs
    to be looped over 
**********/
function huntForUser(list, checkName, callback) {
    //console.log("list length: " + list.length);
    var array = [];
    for(var l = 0; l < list.length; l++) {
        moreDamnFunctions(l,list[l], function(Result,tempid,currentl) {
            //  check that the name is the same as the name entered
            console.log("return from hash: " + tempid + ": " + Result + " for number: " + currentl);
            if(Result == checkName) {
                // found the name appending
                console.log("User Found APPEND");
                userFound = 1;
                array.push(tempid);
            }
            // if the loop is finished
            // and a users is not found
            if((currentl == (list.length - 1))&(userFound == 0)) {
                // at the end of the list,
                // nothing left to check, not found
                console.log("Not found, returning NULL");
                callback(null,null);
            }
            // and atleast one user is found 
            else if((currentl == (list.length - 1))&(userFound  == 1)) {
                // return the array
                callback(array,tempid);
                console.log("Array Result: " + array);
            }
        });
    }
}

/**********
    function to fasilitate the bitchiness of javascript
**********/
function moreDamnFunctions(currentLength, hash, callback) {
    // check that key code and get the first name
    getFromHash(hash, "First", function(Result,tempid){
        callback(Result,tempid,currentLength);
    });
}

/**********
    function to read the authorisedusers.txt file located
    in private folder, then check that the entered data
    matches
**********/
function authoriseUser2(array, username, password, callback) {
    var found = 0; 
    for(var i = 0; i < array.length; i += 2) {
        if((array[i] == username)&(array[i+1] == password)) {
            // found it here
            console.log("found: " + array[i] + " matched entered: " + username);
            found = 1;
        }
        if((i == (array.length-1))&(found == 0)) {
            callback(0);
        } else if((i == (array.length-1))&(found == 1)) {
            callback(1);
        }
    }
}

/**********
    function to pritty much make sure that a for loop is
    finished
**********/
function check(current, full, callback) {
    console.log("cheking current: " + current + " vs Full: " + full);
    if(current == full) {
        callback()
    }
}

/**********
    function to get a subhash from a hash from a redis database
    it returns the object it gets from the subhash
**********/
function getFromHash(hash, subhash, callback) {
    client.hget(hash, subhash, function(err,obj2) {
        if(obj2 != null) {
            //console.log("getFromHash: " + obj2);
            callback(obj2,hash);
        } else {
            callback("0",hash);
        }
    });
}

/**********
    function to get a list from the redis database. it then
    returns the object, which is an array of strings(can be used
    as hashes)
**********/
function getFullList(list, callback) {
    client.lrange(list, 0, -1, function(err,obj) {
        if(obj != null) {
            //console.log("getFullList: " + obj);
            callback(obj);
        } else {
            callback("0");
        }
    });
}

/***********
    function to serv an error page to the users browser
    the page can be eddited acording to where it fails
    using "thing" "error message" and "advice"
***********/
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

/***********
    function to replace and return user data in buildstring
***********/
function buildUser(Hash, buildString, runs, callback) {
    // get from redis, then replace the "keyword" in the
    // build string
    getFromHash(Hash, "First", function(Result) {
        buildString = buildString.replace("%FIRSTNAME%", Result);
    });
    
    getFromHash(Hash, "Last", function(Result) {
        buildString = buildString.replace("%LASTNAME%", Result);
    });
    
    getFromHash(Hash, "Email", function(Result) {
        buildString = buildString.replace("%EMAIL%", Result);
    });

    getFromHash(Hash, "RFID", function(Result) {
        buildString = buildString.replace(/%CARDRFID%/g, Result); 
    });

    getFromHash(Hash, "Human Time", function(Result) {
        buildString = buildString.replace("%TIME%", Result);
    });

    getFromHash(Hash, "Lollies", function(Result){
        if(Result == "1") {
            buildString = buildString.replace("%LOLLIES%", "checked");
        } else {
            buildString = buildString.replace("%LOLLIES%", "");
        }
        console.log(buildString);
        callback(buildString,runs);
    });

    // need to add for coffee and door
    // extra permissions go here
}

/***********
    function to serve a page to the user, this is called from
    a GET request usually, as it abstracts away the json decoding
***********/
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
                        var runs = 0;
                        var finalResult;
                        var hashvalue = "";
                        var fixedString =  "<br>\
                                            Card RFID Hash: %CARDRFID%<br>\
                                            First Name: %FIRSTNAME%<br>\
                                            Last Name: %LASTNAME%<br>\
                                            Email: %EMAIL%<br>\
                                            Last Scan: %TIME%<br>\
                                            Lollies: %LOLLIES%<br>\
                                            ";
                        
                        // reset
                        userFound = 0;
                        finishedString = "";
                        // begin hunting for users, returns an array of users.
                        huntForUser(listArray, decode.checkName, function(finalResult) {
                            // if there is no user with that name
                            if(finalResult == null) {
                                console.log("No User with that name found");
                                // serveerror page
                                servError(req, res, "There is no User: ", "\"" + (decode.checkName + "\""), "Make sure this is the correct First Name (It is Case Sensative).");
                            } else {
                                console.log("Users with that name found");
                                // set all the user entered data into the details page
                                for(var i = 0; i < finalResult.length; i++) {
                                    // fill the fixed string data with the users data
                                    buildUser(finalResult[i], fixedString, i, function(Result, runs) {
                                        // then add it to the finished string
                                        finishedString += Result;
                                        // at the end of the length of the array, replace and serv.
                                        check(runs, (finalResult.length-1), function() {
                                            // serv page
                                            final = final.replace("%REPLACE%", finishedString);
                                            res.end(final);
                                        });
                                    });
                                }
                            }
                        });
                    }
                });
            } else {
                res.end(contents);
            }
        } else {
            console.log("Issues serving " + fileName);
            console.dir(err);
            //if the file was not found, set a 404 header...
            res.writeHead(404, {'Content-Type': 'text/html'});
            res.end('<h1>Sorry, the page you are looking for cannot be found.</h1>');
        }
    });
}
 
/***********
    function that is the main html page server
    it also deals with get and post requests and
    calls the functions above, when needed
***********/
function requestHandler(req, res) {
    var content = '';
    var fileName = path.normalize(req.url); //the file that was requested
    var privfileName = "";
    var localFolder = __dirname + '/public';//where our public files are located
    var privateFolder = __dirname + '/private';

    //NOTE: __dirname returns the root folder that
    //this javascript file is in.
    if(req.method == "GET") {
        console.log("GET request for: " + req.url);
        if(fileName === '/form.html') {
            content = localFolder + fileName;
     
            //reads the file referenced by 'content'
            fs.readFile(content,function(err,contents){
                if(!err){
                    // send the data
                    res.end(contents);
                } else {
                    //otherwise, let us inspect the eror
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
            fs.readFile(content,function(err,contents){
                if(!err){
                    // send the data
                    res.end(contents);
                } else {
                    console.dir(err);
                };
            });
        } else {
            // any other file
            content = localFolder + fileName;//setup the file name to be returned
            fs.readFile(content,function(err,contents){
                if(!err){
                    res.end(contents);
                } else {
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
                //console.log(fullBody + "<--- post data");
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
        } else if(fileName == "/manageusers.html") {
            
            var fullBody = '';
            var array; 

            req.on('data', function(data) {
                fullBody += data.toString();
            });

            req.on('end', function() {
                // node side
                console.log(fullBody + "<--- post data");

                // decode
                var decode = querystring.parse(fullBody);

                // display the data
                console.log(decode.username + "<==== Username");
                console.log(decode.password + "<==== Password");

                privfileName = "/authorisedusers.txt";
                privcontent = privateFolder + privfileName;
                console.log(privcontent);

                fs.readFile(privcontent, function(err, data) {
                    if(err) {
                        servError(req, res, "Authorised Users file ", "NOT FOUND", "Add an Authorised User file.");
                        return;
                    } 
                    // creat the array of usernames / passowords
                    array = data.toString().split("\n");
                    var temp = 0;
                    // send to check function, then run an async function callback
                    authoriseUser2(array,decode.username,decode.password,function(temp) {
                        if(temp == 1) {
                            console.log("USER AUTHORISED");
                            // load the file
                            content = localFolder + fileName;
                            fs.readFile(content,function(err,contents){
                                //if the fileRead was successful...
                                if(!err){
                                    // will fill with user data
                                    var fixedUserForm = "\
                                                        <form id='%CARDRFID%_form' action='/manageSubmit.html' method='post' target = '_self'>\
                                                        <label>RFID Hash: <u>%CARDRFID%</u></label><br>\
                                                        <input name='%CARDRFID%_first' type='text' value='%FIRSTNAME%' id = '%CARDRFID%_first'>\
                                                        <input name='%CARDRFID%_last' type='text' value='%LASTNAME%' id = '%CARDRFID%_first'>\
                                                        <input name='%CARDRFID%_email' type='text' value='%EMAIL%' id = '%CARDRFID%_first'><br>\
                                                        <label>Permissions: </label>\
                                                        <label>L</label>\
                                                        <input name='%CARDRFID%_Lollies' type='checkbox' value='%CARDRFID%_lollies' id = '%CARDRFID%_lollies' %LOLLIES%>\
                                                        <label>C</label>\
                                                        <input name='%CARDRFID%_Coffee' type='checkbox' value='%CARDRFID%_Coffee' id = '%CARDRFID%_Coffee' %COFFEE%>\
                                                        <label>D</label>\
                                                        <input name='%CARDRFID%_Door' type='checkbox' value='%CARDRFID%_Door' id = '%CARDRFID%_Door' %DOOR%>\
                                                        <input type='submit' value='Change' id = '%CARDRFID%_submit'>\
                                                        </form>\
                                                        ";
                                    var final = '';
                                    var managedata = "";
                                    var listArray = [];
                                    final = contents.toString(); 

                                    // check all registered cards
                                    getFullList("Registered", function(listArray){
                                        ready = 0;
                                        if(listArray == "0") {
                                            // throw error
                                            ready = 1;
                                            servError(req, res, "The List returned was:", "NULL ", "This could be a redis issue or there are no registered users");
                                        } else {
                                            // nothing wrong
                                            var datcheck = 0;
                                            for(var l = 0; l < listArray.length; l++) {
                                                console.log("Registered User[" + l +"]: " +listArray[l]);
                                                // send to builduserstring here
                                                buildUser(listArray[l],fixedUserForm,l,function(Result,runs) {
                                                    managedata += Result;
                                                    managedata += "<br>";

                                                    check(runs, (listArray.length-1), function() {
                                                        // serv page
                                                        console.log(managedata);
                                                        final = final.replace("%REGISTEREDUSER%", managedata);
                                                        res.end(final);
                                                    });
                                                });
                                            }
                                        }
                                    });
                                } else {
                                    console.dir(err);
                                }
                            });
                        } else {
                            console.log("USER UN-AUTHORISED");
                            servError(req, res, "Entered Data ", "UN-AUTHORISED ", "Make sure you have typed your credentials correctly.");
                        }
                    });      
                });
            });
        }
    };
};
 
console.log("Server Port: " + port);
http.createServer(requestHandler)
.listen(port);

console.log("started");
