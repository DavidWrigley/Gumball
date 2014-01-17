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
function servMessage(type, req, res, thing, errorMessage, advice) {
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
            final = final.replace("%TYPE%", type);
            final = final.replace("%THING%", thing);
            final = final.replace("%MESSAGE%", errorMessage);
            final = final.replace("%ADVICE%", advice);
            
            // send the data
            res.end(final);
        } else {
            console.log("Something went wrong serving error page");
        }
    });
}

/***********
    function sort the dic into an array
***********/
function keys(obj, minimum, maximum) {
    var keys = [];
    for(var key in obj)
    {
        if(obj.hasOwnProperty(key))
        {
            if((parseInt(key,10) > minimum)&(parseInt(key,10) < maximum)) {
                keys.push(key);
            }
        }
    }
    return keys.sort();
}

/***********
    function to return all the contents of a hash
***********/
function getAllFromHash(Hash, minimum, maximum, callback) {
    var sortedKeys = [];
    console.log("Hash value: " + Hash);
    client.hgetall(Hash, function(err,obj) {
        console.dir(obj);
        sortedKeys = keys(obj, minimum, maximum);
        console.log("sorted array: " + sortedKeys);
        if(obj != null) {
            callback(obj, sortedKeys);
        } else {
            callback(null, null);
        }
    });
}

/***********
    function to get the start of the day in UTC time
***********/
function UTCStartDay(Year, Month, Day, Current, Callback) {
    var da = new Date();
    // get the number of days through the week.
    var daysthroughweek = (da.getDay()-1);
    // get the seconds for the beginning of the required day.
    seconds = Date.UTC(Year,Month,(Day-(daysthroughweek-Current)));
    // debug
    console.log(seconds)
    // return it.
    console.log("UTC Time for: " + Current + " :" + seconds);
    return seconds
}

/***********
    function to replace keys inside the table.html sign in system
***********/
function buildTable(Hash, buildString, callback) {
    // alter the hash, to construct the timesheet
    Hash = Hash + "_doorLog";
    var da = new Date();
    
    var CurrentDay = 0;
    var minimum = 0;
    var maximum = 0;

    minimum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay);
    maximum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay+1);
    // build for monday day 2 
    getAllFromHash(Hash, minimum, maximum, function(Result, SortedKeys) {
        console.log("from getAllFromHash: " + Result);
        // remove excessive entries.
        // and detect if the users signed off in am or no.
        if((Result != null)&(SortedKeys != null)) {
            for(var i = 0; i < SortedKeys.length; i++) {
                console.log("Result of: " + SortedKeys[i] + " is: " + Result[SortedKeys[i]]);
                if(Result[SortedKeys[i]] == 1) {
                    // create date object
                    var DateObj = new Date(SortedKeys[i]);
                    // user sign in.
                    // replace MOAON
                    console.log(DateObj);
                    buildString.replace("%MOAON%", DateObj.getHours());
                }
            }
        }
    });

    CurrentDay++;
    // build for tuesday day 3
    minimum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay);
    maximum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay+1);
    // build for monday day 2 
    getAllFromHash(Hash, minimum, maximum, function(Result, SortedKeys) {
        console.log("from getAllFromHash: " + Result);
        // use this data to then format the table.
        // // and detect if the users signed off in am or no.
        if((Result != null)&(SortedKeys != null)) {
            for(var i = 0; i < SortedKeys.length; i++) {
                console.log("Result of: " + SortedKeys[i] + " is: " + Result[SortedKeys[i]]);
            }
        }
    });

    CurrentDay++;
    // build for tuesday day 3
    minimum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay);
    maximum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay+1);
    // build for monday day 2 
    getAllFromHash(Hash, minimum, maximum, function(Result, SortedKeys) {
        console.log("from getAllFromHash: " + Result);
        // use this data to then format the table.
        // // and detect if the users signed off in am or no.
        if((Result != null)&(SortedKeys != null)) {
            if(SortedKeys.length <= 2) {
                // create date object
                var DateObj = new Date(parseInt(SortedKeys[0],10));
                var TimeString = DateObj.toLocaleTimeString()
                buildString = buildString.replace("%MOAON%", TimeString);
                DateObj = new Date(parseInt(SortedKeys[1],10));
                TimeString = DateObj.toLocaleTimeString()
                buildString = buildString.replace("%MOAOFF%", TimeString);
            }
            for(var i = 0; i < SortedKeys.length; i++) {
                console.log("Result of: " + SortedKeys[i] + " is: " + Result[SortedKeys[i]]);
                if(Result[SortedKeys[i]] == 1) {
                    // create date object
                    var DateObj = new Date(parseInt(SortedKeys[i],10));
                    var TimeString = DateObj.toLocaleTimeString()
                    // user sign in.
                    // replace MOAON
                    console.log(DateObj.toLocaleTimeString());
                    buildString = buildString.replace("%MOAON%", TimeString);
                }

            }
        }
    });

    CurrentDay++;
    // build for tuesday day 3
    minimum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay);
    maximum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay+1);
    // build for monday day 2 
    getAllFromHash(Hash, minimum, maximum, function(Result, SortedKeys) {
        console.log("from getAllFromHash: " + Result);
        // use this data to then format the table.
        // and detect if the users signed off in am or no.
        if((Result != null)&(SortedKeys != null)) {
            for(var i = 0; i < SortedKeys.length; i++) {
                console.log("Result of: " + SortedKeys[i] + " is: " + Result[SortedKeys[i]]);
            }
        }
    });

    CurrentDay++;
    // build for tuesday day 3
    minimum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay);
    maximum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),CurrentDay+1);
    // build for monday day 2 
    getAllFromHash(Hash, minimum, maximum, function(Result, SortedKeys) {
        console.log("from getAllFromHash: " + Result);
        // use this data to then format the table.
        // // and detect if the users signed off in am or no.
        if((Result != null)&(SortedKeys != null)) {
            for(var i = 0; i < SortedKeys.length; i++) {
                console.log("Result of: " + SortedKeys[i] + " is: " + Result[SortedKeys[i]]);
            }
        }
        callback(buildString);
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
    });

    getFromHash(Hash, "Door", function(Result){
        if(Result == "1") {
            buildString = buildString.replace("%DOOR%", "checked");
        } else {
            buildString = buildString.replace("%DOOR%", "");
        }
        callback(buildString,runs);
    });


    // need to add for coffee and door
    // extra permissions go here
}

/***********
    function to set some varables, may be adapted to follow
    an array of varables rather than just preset ones may need
    to incorperate number of times run also.
***********/
function setUser(hash, decode, callback) {
    // set the RFID tag
    client.hset(hash, "RFID", hash, redis.print);
    // set the name.
    client.hset(hash, "First", decode.firstName, redis.print);
    // set the last name
    client.hset(hash, "Last", decode.lastName, redis.print);
    // set the email
    client.hset(hash, "Email", decode.email, redis.print);
    // set the lollies
    if(decode.lollies == "lollies") {
        client.hset(hash, "Lollies", "1", redis.print);
    } else {
        client.hset(hash, "Lollies", "0", redis.print);
    }
    // set the door
    if(decode.door == "door") {
        client.hset(hash, "Door", "1", redis.print);
    } else {
        client.hset(hash, "Door", "0", redis.print);
    }
    // add coffee and door here later TODO:
    callback(1);
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
                        servMessage("ERROR!", req, res, "The List returned was:", "NULL ", "This could be a redis issue or there are no registered users");
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
                                            Door: %DOOR%<br>\
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
                                servMessage("ERROR!", req, res, "There is no User: ", "\"" + (decode.checkName + "\""), "Make sure this is the correct First Name (It is Case Sensative).");
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
            
            // test
            buildTable("edffe939fd3d2252895737c0eb63ae27", "this is a string, that contains things %MOAON%", function(Hue) {
                console.log("Done: " + Hue);
            });

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
                // decode
                var decode = querystring.parse(fullBody);

                // organise the redis data here
                client.hget("Unregistered", decode.key.toString(), function(err,obj) {
                    // will get the rfid
                    rfidTag = obj;
                    var thing = "";
                    if(rfidTag != null) {
                        console.log("Registering: " + rfidTag);

                        setUser(rfidTag,decode, function(Hue) {
                            console.log("user set completion with: " + Hue);
                        });

                        // delete the hash key in unregistered
                        client.hdel("Unregistered", decode.key.toString(), redis.print);

                        // add to the registered list of cards
                        client.lpush("Registered", rfidTag, redis.print);

                        // serve up the completion page
                        // servPage("/registerSubmit.html", req, res, decode, rfidTag);
                        servMessage("SUCCESS!", req, res, "The Card Code: ", decode.key, "Is now Registered and in the system.")
                    }
                    else {
                        thing = thing + "The Card Code: \"" + decode.key + "\": "
                        servMessage("ERROR!", req, res, thing, "Does not exist in \"Unregistered\" Cards", "Scan again to check your Card Code, You may also already be Registered");
                    }
                });
            });
        } else if(req.url == "/userdata.html") {
            var fullBody = '';

            req.on('data', function(data) {
                fullBody += data.toString();
            });

            req.on('end', function() {
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
                // decode
                var decode = querystring.parse(fullBody);

                // display the data
                console.log(decode.username + "<==== Username");
                console.log(decode.password + "<==== Password");

                privfileName = "/authorisedusers.txt";
                privcontent = privateFolder + privfileName;

                fs.readFile(privcontent, function(err, data) {
                    if(err) {
                        servMessage("ERROR!", req, res, "Authorised Users file ", "NOT FOUND", "Add an Authorised User file.");
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
                                                        <form id='%CARDRFID%_form' action='/manageSubmit/%CARDRFID%' method='post' target = '_self'>\
                                                        <label>RFID Hash: <u>%CARDRFID%</u></label><br>\
                                                        <input name='firstName' type='text' value='%FIRSTNAME%' id = 'firstName'>\
                                                        <input name='lastName' type='text' value='%LASTNAME%' id = 'lastName'>\
                                                        <input name='email' type='text' value='%EMAIL%' id = 'email'><br>\
                                                        <label>Permissions: </label>\
                                                        <label>L</label>\
                                                        <input name='lollies' type='checkbox' value='lollies' id = 'lollies' %LOLLIES%>\
                                                        <label>C</label>\
                                                        <input name='coffee' type='checkbox' value='coffee' id = 'coffee' %COFFEE%>\
                                                        <label>D</label>\
                                                        <input name='door' type='checkbox' value='door' id = 'door' %DOOR%><br>\
                                                        <input type='radio' name='select' value='Change' checked>Change<br>\
                                                        <input type='radio' name='select' value='Delete'>Delete<br>\
                                                        <input type='submit' value='OK' id = 'ok'>\
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
                                            servMessage("ERROR!", req, res, "The List returned was:", "NULL ", "This could be a redis issue or there are no registered users");
                                        } else {
                                            // nothing wrong
                                            var datcheck = 0;
                                            for(var l = 0; l < listArray.length; l++) {
                                                console.log("Registered User[" + l +"]: " +listArray[l]);
                                                // send to builduserstring here
                                                buildUser(listArray[l],fixedUserForm,l,function(Result,runs) {
                                                    managedata += Result;
                                                    //managedata += "<br>";

                                                    check(runs, (listArray.length-1), function() {
                                                        // serv page
                                                        // console.log(managedata);
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
                            servMessage("ERROR!", req, res, "Entered Data ", "UN-AUTHORISED ", "Make sure you have typed your credentials correctly.");
                        }
                    });      
                });
            });
        } else if (fileName.toString().indexOf("/manageSubmit.html")) {
            var fullBody = '';
            var rfidTag = null;
            req.on('data', function(data) {
                fullBody += data.toString();
            });

            req.on('end', function() {
                console.log(fullBody);

                // decode
                var decode = querystring.parse(fullBody);
                
                // get the RFID Tag, for redis
                rfidTag = fileName.toString().split("/")[2];

                console.log("Rfid Tag: " + rfidTag);

                if(rfidTag != null) {
                    if(decode.select == "Change") {
                        console.log("Require Change");
                        setUser(rfidTag, decode, function(Hue) {
                            console.log("eddited: " + rfidTag);
                            // give user conformation
                            servMessage("SUCCESS!", req, res, "User Change: ", "Successful", "Click Submit Again to continue managing Users");
                        })
                    } else if(decode.select == "Delete") {
                        console.log("Require Delete");
                        // delete the hash
                        client.del(rfidTag, redis.print);
                        // remove from registed also
                        client.lrem("Registered",1,rfidTag);                        
                        servMessage("SUCCESS!", req, res, "User Delete: ", "Successful", "Click Submit Again to continue managing Users");
                    }
                }
            });
        }
    };
};
 
console.log("Server Port: " + port);
http.createServer(requestHandler)
.listen(port);

console.log("started");
