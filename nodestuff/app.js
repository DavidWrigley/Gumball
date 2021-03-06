/*
global varables
 */
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
var runningTimeTotal = [0,0,0,0,0];
var dayArray = ["MO","TU","WE","TH","FR"];

/*
initial functions
 */
client.select(10, function() {
    console.log("redis connected on 10");
});

/*
if redis error occurs print here
 */
client.on("error", function(err) {
    console.log("Redis Error:" + err);
});

/**
 * function that hunts for the users in the registered redis datadase
 * returns an array, that can hold more then one user, this needs
 * to be looped over 
 * @param  {array}   list
 * @param  {string}   checkName
 * @param  {Function} callback
 * @return {null}
 */
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

/**
 * function to fasilitate the bitchiness of javascript
 * @param  {[int]}   currentLength
 * @param  {[string]}   hash
 * @param  {Function} callback
 * @return {[null]}
 */
function moreDamnFunctions(currentLength, hash, callback) {
    // check that key code and get the first name
    getFromHash(hash, "First", function(Result,tempid){
        callback(Result,tempid,currentLength);
    });
}

/**
 * function to read the authoriseduseres.txt file located in the private
 * folder, then check that the entered data matches
 * @param  {array}   array
 * @param  {string}   username
 * @param  {string}   password
 * @param  {Function} callback
 * @return {null}
 */
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

/**
 * function to pritty much make sure that a for loop is finished
 * @param  {int}   current
 * @param  {int}   full
 * @param  {Function} callback
 * @return {null}
 */
function check(current, full, callback) {
    console.log("cheking current: " + current + " vs Full: " + full);
    if(current == full) {
        callback()
    }
}

/**
 * function to get a subhash and value from a hash from the redis database
 * it returens the object it gets from the subhash
 * @param  {string}   hash
 * @param  {string}   subhash
 * @param  {Function} callback
 * @return {null}
 */
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

/**
 * function to get a list from the redis database. it then retunrs the object,
 * whcih is an array of strings
 * @param  {array}   list
 * @param  {Function} callback
 * @return {null}
 */
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

/**
 * function to serv a message page to the users browser the page can be eddited
 * acording to where it fails using the varables "thing", "error message" and "advice"
 * @param  {string} type
 * @param  {object} req
 * @param  {object} res
 * @param  {string} thing
 * @param  {string} errorMessage
 * @param  {string} advice
 * @return {null}
 */
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

/**
 * function to sort a dic into an array
 * @param  {object} obj
 * @param  {int} minimum
 * @param  {int} maximum
 * @return {array}
 */
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
    // sort
    return keys.sort();
}

/**
 * function to return all the contenst of a hash sorted in ascending order and between
 * a maximum and minimum value
 * @param  {string}   Hash
 * @param  {int}   minimum
 * @param  {int}   maximum
 * @param  {int}   count
 * @param  {Function} callback
 * @return {null}
 */
function getAllFromHash(Hash, minimum, maximum, count, callback) {
    var sortedKeys = [];
    console.log("Hash value: " + Hash);
    client.hgetall(Hash, function(err,obj) {
        console.dir(obj);
        sortedKeys = keys(obj, minimum, maximum);
        console.log("sorted array: " + sortedKeys);
        if(obj != null) {
            callback(obj, sortedKeys, count, minimum);
        } else {
            callback(null, null, count, minimum);
        }
    });
}

/**
 * function to get the start of the day in UTC time
 * @param {int} Year
 * @param {int} Month
 * @param {int} Day
 * @param {int} Current
 * @param {Function} Callback
 * @param {int} return
 */
function UTCStartDay(Year, Month, Day, Current, Callback) {
    var da = new Date();
    // get the number of days through the week.
    var daysthroughweek = (da.getDay()-1);
    // get the seconds for the beginning of the required day.
    seconds = Date.UTC(Year,Month,(Day-(daysthroughweek-Current)));
    //seconds -= (da.getTimezoneOffset()/60);
    seconds += (da.getTimezoneOffset()*60*1000);
    // debug
    console.log(seconds)
    // return it.
    console.log("UTC Time for: " + Current + " :" + seconds);
    return seconds
}

/**
 * function to fill a string with details about the current
 * day for the timesheet system. mainily in a function to reduce
 * code size.
 * @param  {string}   buildString
 * @param  {int}   dayno
 * @param  {array}   utcArray
 * @param  {array}   Result
 * @param  {int}   currentcount
 * @param  {Function} callback
 * @return {null}
 */
function fillHours(buildString, dayno, utcArray, Result, currentcount, callback) {
    if((Result != null)&(utcArray != null)) {
        // if the user only signed in once
        var day = dayArray[dayno];      

        console.log(utcArray.length);
        if((utcArray.length == 0)|(utcArray == null)) {
            // user did not sign in that day
            buildString = buildString.replace("%" + day + "AON%", "-");
            buildString = buildString.replace("%" + day + "AOFF%", "-");

            buildString = buildString.replace("%" + day + "PON%", "-");
            buildString = buildString.replace("%" + day + "POFF%", "-");
            buildString = buildString.replace("%" + day + "TOTAL%", "-");

            // running hours total
            var timeDiffTotal = 0;
            for(var j = 0; j < 5; j++) {
                timeDiffTotal += runningTimeTotal[j]
            }

            hours = Math.floor(timeDiffTotal / 36e5)
            mins = Math.floor((timeDiffTotal % 36e5) / 6e4)
            secs = Math.floor((timeDiffTotal % 6e4) / 1000);   

            var runningTotal = (hours + ":" + mins + ":" + secs);   

            buildString = buildString = buildString.replace("%" + day + "RTOTAL%", runningTotal);   

            callback(buildString,currentcount);
        }
        else if(utcArray.length == 1) {
            // create date object
            var DateObj = new Date(parseInt(utcArray[0],10));
            buildString = buildString.replace("%" + day + "AON%", DateObj.toLocaleTimeString());
            buildString = buildString.replace("%" + day + "AOFF%", "-");
            buildString = buildString.replace("%" + day + "PON%", "-");
            buildString = buildString.replace("%" + day + "POFF%", "-");
            buildString = buildString.replace("%" + day + "TOTAL%", "-"); 
            
            // running hours total
            var timeDiffTotal = 0;
            for(var j = 0; j < 5; j++) {
                timeDiffTotal += runningTimeTotal[j]
            }

            hours = Math.floor(timeDiffTotal / 36e5)
            mins = Math.floor((timeDiffTotal % 36e5) / 6e4)
            secs = Math.floor((timeDiffTotal % 6e4) / 1000);   

            var runningTotal = (hours + ":" + mins + ":" + secs);   
            buildString = buildString.replace("%" + day + "RTOTAL%", runningTotal);
            callback(buildString,currentcount);
        } 
        // they signed in then out
        else if(utcArray.length == 2) {
            var DateObj = new Date(parseInt(utcArray[0],10));
            buildString = buildString.replace("%" + day + "AON%", DateObj.toLocaleTimeString());
            buildString = buildString.replace("%" + day + "AOFF%", "-");
            DateObj = new Date(parseInt(utcArray[1],10));
            buildString = buildString.replace("%" + day + "PON%", "-");
            buildString = buildString.replace("%" + day + "POFF%", DateObj.toLocaleTimeString()); 

            var timeDiff = ( parseInt(utcArray[1],10) - (parseInt(utcArray[0],10)));

            // total hours for today
            runningTimeTotal[dayno] = timeDiff;

            var hours = Math.floor(timeDiff / 36e5)
            var mins = Math.floor((timeDiff % 36e5) / 6e4)
            var secs = Math.floor((timeDiff % 6e4) / 1000); 
            
            var total = (hours + ":" + mins + ":" + secs);

            buildString = buildString.replace("%" + day + "TOTAL%", total);

            // running hours total
            var timeDiffTotal = 0;
            for(var j = 0; j < 5; j++) {
                timeDiffTotal += runningTimeTotal[j]
            }

            hours = Math.floor(timeDiffTotal / 36e5)
            mins = Math.floor((timeDiffTotal % 36e5) / 6e4)
            secs = Math.floor((timeDiffTotal % 6e4) / 1000);   

            var runningTotal = (hours + ":" + mins + ":" + secs);   

            buildString = buildString.replace("%" + day + "RTOTAL%", runningTotal);   
            callback(buildString,currentcount);
        }
        // they signed in then out then in again.
        else if(utcArray.length == 3) {
            var DateObj = new Date(parseInt(utcArray[0],10));
            buildString = buildString.replace("%" + day + "AON%", DateObj.toLocaleTimeString());
            DateObj = new Date(parseInt(utcArray[1],10));
            buildString = buildString.replace("%" + day + "AOFF%", DateObj.toLocaleTimeString());
            DateObj = new Date(parseInt(utcArray[2],10));
            buildString = buildString.replace("%" + day + "PON%", DateObj.toLocaleTimeString());
            buildString = buildString.replace("%" + day + "POFF%", "-"); 

            var timeDiff = ( parseInt(utcArray[1],10) - (parseInt(utcArray[0],10)));

            // total hours for today
            runningTimeTotal[dayno] = timeDiff;

            var hours = Math.floor(timeDiff / 36e5)
            var mins = Math.floor((timeDiff % 36e5) / 6e4)
            var secs = Math.floor((timeDiff % 6e4) / 1000); 
            
            var total = (hours + ":" + mins + ":" + secs);

            buildString = buildString.replace("%" + day + "TOTAL%", total);

            // running hours total
            var timeDiffTotal = 0;
            for(var j = 0; j < 5; j++) {
                timeDiffTotal += runningTimeTotal[j]
            }

            hours = Math.floor(timeDiffTotal / 36e5)
            mins = Math.floor((timeDiffTotal % 36e5) / 6e4)
            secs = Math.floor((timeDiffTotal % 6e4) / 1000);   

            var runningTotal = (hours + ":" + mins + ":" + secs);  

            buildString = buildString.replace("%" + day + "RTOTAL%", runningTotal);  

            callback(buildString,currentcount);
        }
        // they correctly sign in out in out.
        else if(utcArray.length == 4) {
            var DateObj = new Date(parseInt(utcArray[0],10));
            buildString = buildString.replace("%" + day + "AON%", DateObj.toLocaleTimeString());
            DateObj = new Date(parseInt(utcArray[1],10));
            buildString = buildString.replace("%" + day + "AOFF%", DateObj.toLocaleTimeString());

            DateObj = new Date(parseInt(utcArray[2],10));
            buildString = buildString.replace("%" + day + "PON%", DateObj.toLocaleTimeString());
            DateObj = new Date(parseInt(utcArray[3],10));
            buildString = buildString.replace("%" + day + "POFF%", DateObj.toLocaleTimeString());
            
            var timeDiff = (( parseInt(utcArray[1],10) - parseInt(utcArray[0],10) ) + ( parseInt(utcArray[3],10) - parseInt(utcArray[2],10)));

            // total hours for today
            runningTimeTotal[dayno] = timeDiff;

            var hours = Math.floor(timeDiff / 3600000)
            var mins = Math.floor((timeDiff % 3600000) / 60000)
            var secs = Math.floor((timeDiff % 60000) / 1000); 
            
            var total = (hours + ":" + mins + ":" + secs);

            buildString = buildString.replace("%" + day + "TOTAL%", total);

            // running hours total
            var timeDiffTotal = 0;
            for(var j = 0; j < 5; j++) {
                timeDiffTotal += runningTimeTotal[j]
            }

            hours = Math.floor(timeDiffTotal / 36e5)
            mins = Math.floor((timeDiffTotal % 36e5) / 6e4)
            secs = Math.floor((timeDiffTotal % 6e4) / 1000);   

            var runningTotal = (hours + ":" + mins + ":" + secs);   

            buildString = buildString.replace("%" + day + "RTOTAL%", runningTotal);   

            callback(buildString,currentcount);
        } else if(utcArray.length > 4) {
            // user signed in more then they should have
            console.log("User signed in: " + utcArray.length);
            var timeDiff = 0;
            // if the entries are even
            // that means there are even sign on / off paris. put first and last
            // on the sheet with "~" as inbetween but add all the time togeather
            // and put it to toal.
            if((utcArray.length % 2) == 0) {
                var DateObj = new Date(parseInt(utcArray[0],10));
                buildString = buildString.replace("%" + day + "AON%", DateObj.toLocaleTimeString());
                buildString = buildString.replace("%" + day + "AOFF%", "<...>");
                DateObj = new Date(parseInt(utcArray[(utcArray.length)-1],10));
                buildString = buildString.replace("%" + day + "PON%", "<...>");
                buildString = buildString.replace("%" + day + "POFF%", DateObj.toLocaleTimeString()); 
                
                // sum all hours
                for(var x = 0; x < (utcArray.length - 1); x++) {
                    timeDiff += ( parseInt(utcArray[x+1],10) - parseInt(utcArray[x],10) )
                }
                console.log("total time spent in building: " + timeDiff);
                runningTimeTotal[dayno] = timeDiff;

                var hours = Math.floor(timeDiff / 3600000)
                var mins = Math.floor((timeDiff % 3600000) / 60000)
                var secs = Math.floor((timeDiff % 60000) / 1000); 
                
                var total = (hours + ":" + mins + ":" + secs);

                buildString = buildString.replace("%" + day + "TOTAL%", total);

                // running hours total
                var timeDiffTotal = 0;
                for(var j = 0; j < 5; j++) {
                    timeDiffTotal += runningTimeTotal[j]
                }

                hours = Math.floor(timeDiffTotal / 36e5)
                mins = Math.floor((timeDiffTotal % 36e5) / 6e4)
                secs = Math.floor((timeDiffTotal % 6e4) / 1000);   

                var runningTotal = (hours + ":" + mins + ":" + secs);   

                buildString = buildString.replace("%" + day + "RTOTAL%", runningTotal); 
                callback(buildString,currentcount);
            }
            // if the entrues are odd
            // meaning the users has not yet signed out for the last time.
            // put the first in AM start and the last in PM Start.
            else if((utcArray.length % 2) == 1) {
                var DateObj = new Date(parseInt(utcArray[0],10));
                buildString = buildString.replace("%" + day + "AON%", DateObj.toLocaleTimeString());
                buildString = buildString.replace("%" + day + "AOFF%", "<...>");
                DateObj = new Date(parseInt(utcArray[(utcArray.length)-1],10));
                buildString = buildString.replace("%" + day + "PON%", DateObj.toLocaleTimeString());
                buildString = buildString.replace("%" + day + "POFF%", "<...>"); 

                // sum all hours
                for(var x = 0; x < (utcArray.length - 2); x++) {
                    timeDiff += ( parseInt(utcArray[x+1],10) - parseInt(utcArray[x],10) )
                }
                console.log("total time spent in building: " + timeDiff);
                runningTimeTotal[dayno] = timeDiff;

                var hours = Math.floor(timeDiff / 3600000)
                var mins = Math.floor((timeDiff % 3600000) / 60000)
                var secs = Math.floor((timeDiff % 60000) / 1000); 
                
                var total = (hours + ":" + mins + ":" + secs);

                buildString = buildString.replace("%" + day + "TOTAL%", total);

                // running hours total
                var timeDiffTotal = 0;
                for(var j = 0; j < 5; j++) {
                    timeDiffTotal += runningTimeTotal[j]
                }

                hours = Math.floor(timeDiffTotal / 36e5)
                mins = Math.floor((timeDiffTotal % 36e5) / 6e4)
                secs = Math.floor((timeDiffTotal % 6e4) / 1000);   

                var runningTotal = (hours + ":" + mins + ":" + secs);   

                buildString = buildString.replace("%" + day + "RTOTAL%", runningTotal); 
                callback(buildString,currentcount);
            }
            callback(null,currentcount);
        }
    }
}

/**
 * splice an element from an array, then callback with the array minus the splice
 * @param  {array}   array
 * @param  {int}   index
 * @param  {int}   count
 * @param  {Function} callback
 * @return {null}
 */
function do_the_splice(array, index, count, callback) {
    console.log("splicing: " + array.splice(index, 1) + " with count: " + i);
    callback(array,count);
}

/**
 * function to loop through an array to splice out unwanted elements
 * @param  {array}   array
 * @param  {Function} callback
 * @return {null}
 */
function arraySplice(array, callback) {
    var index = 0;
    var length = array.length;
    for(var i = 2; i < (length - 2); i++) {
        index = 2;
        if (index > -1) {
            do_the_splice(array,2,i,function(Hue, count) {
                if(count > (array.length-2)) {
                    callback(array);
                }
            });
        }
    }
}

/**
 * build the timesheet table for the users from monday to friday
 * @param  {string}   Hash
 * @param  {string}   buildString
 * @param  {object}   req
 * @param  {object}   res
 * @param  {Function} callback
 * @return {null}
 */
function buildTable(Hash, buildString, req, res, callback) {
    // alter the hash, to construct the timesheet
    Hash = Hash + "_doorLog";
    var da = new Date();
    
    var CurrentDay = "";
    var minimum = 0;
    var maximum = 0;
    runningTimeTotal = [0,0,0,0,0];
    var convDate;

    for(var i = 0; i < 5; i++) {
        minimum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),i);
        maximum = UTCStartDay(da.getFullYear(),da.getMonth(),da.getUTCDate(),i+1);
        // build for monday day 2 
        getAllFromHash(Hash, minimum, maximum, i, function(Result, SortedKeys, count, minTime) {
            // remove excessive entries.
            if(SortedKeys != null) {

                console.log(convDate = new Date(minTime));

                buildString = buildString.replace("%D%", (convDate.getUTCDate()+1));
                buildString = buildString.replace("%M%", (convDate.getMonth()+1));
                buildString = buildString.replace("%Y%", convDate.getFullYear());  

                /*
                get the users name and put it in there
                */
                var basehash = Hash.toString().split("_")[0];
                getFromHash(basehash, "First", function(Hue,err) {
                    buildString = buildString.replace("%NAME%", Hue);
                    // and detect if the users signed off in am or no.
                    fillHours(buildString, count, SortedKeys, Result, count, function(Hue,currentcount) {
                        //console.log("done with val: " + Hue + "for value: " + currentcount);
                        if(Hue != null) {
                            buildString = Hue;
                        }
                        if(currentcount == 4) {
                            // do callback
                            callback(buildString);
                        }
                    });
                });
            } else {
                servMessage("ERROR!", req, res, "The Hash returned was:", "NULL ", "This is caused becasuse the user had not get rescanned there card after registration");
            }
        });
    }
}

/**
 * function to replace markers in html with specific user details
 * @param  {string}   Hash
 * @param  {string}   buildString
 * @param  {int}   runs
 * @param  {Function} callback
 * @return {null}
 */
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

/**
 * function to set some varables, may be adapted to follow
 * an array of varables rather than just preset ones may need
 * to incorperate number of times run also.
 * @param {string}   hash
 * @param {object}   decode
 * @param {Function} callback
 */
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

/**
 * function to sort a dic into an array
 * @param  {object} obj
 * @return {array}
 */
function keys2(obj) {
    var keys = [];
    for(var key in obj)
    {
        if(obj.hasOwnProperty(key))
        {
            keys.push(key);
        }
    }
    // sort
    return keys.sort();
}

/**
 * function to return all the contenst of a hash sorted in ascending order
 * @param  {string}   Hash
 * @param  {int}   count
 * @param  {Function} callback
 * @return {null}
 */
function getAllFromHash2(Hash, count, callback) {
    var sortedKeys = [];
    console.log("Hash value: " + Hash);
    client.hgetall(Hash, function(err,obj) {
        console.dir(obj);
        sortedKeys = keys2(obj);
        console.log("sorted array: " + sortedKeys);
        if(obj != null) {
            callback(obj, sortedKeys, count);
        } else {
            callback(null, null, count);
        }
    });
}

function fillEvents(buildString, count, Keys, KeysDict, callback) {
    /*
    {
        title: 'Birthday Party',
        start: new Date(y, m, d+1, 19, 0),
        end: new Date(y, m, d+1, 22, 30),
        allDay: false
    }, (only when next exists)
     */
    console.log("fillEvents: " + count);

    // what is the currently checked value
    if(KeysDict[Keys[count]] == "1") {
        try {
            // if the next key is a sign out
            if(KeysDict[Keys[count+1]] == "0") {
                console.log("Correct Sign In!");
                // matched fill start
                var DateObj = new Date(parseInt(Keys[count],10));
                buildString += "{\n"
                buildString += "\ttitle: \'Work\',\n";
                buildString += ("\tstart: new Date(" + DateObj.getFullYear()
                        + ", " + DateObj.getMonth() + ", " + DateObj.getDate()
                        + ", " + DateObj.getHours() + ", " + DateObj.getMinutes() + ", " + DateObj.getSeconds() + "),\n");

                // matched fill end
                // is there enough time between the two entries, need atleast a minute
                if((Keys[count+1] - Keys[count]) < 60000) {
                    console.log("Not enough time different");
                    DateObj = new Date(parseInt(Keys[count+1],10));
                    buildString += ("\tend: new Date(" + DateObj.getFullYear() 
                            + ", " + DateObj.getMonth() + ", " + DateObj.getDate() 
                            + ", " + DateObj.getHours() + ", " + (DateObj.getMinutes() + 1) + ", " + DateObj.getSeconds() + "),\n");
                    buildString += ("\tallDay: false\n");
                    buildString += "}"
                } else {
                    DateObj = new Date(parseInt(Keys[count+1],10));
                    buildString += ("\tend: new Date(" + DateObj.getFullYear() 
                            + ", " + DateObj.getMonth() + ", " + DateObj.getDate() 
                            + ", " + DateObj.getHours() + ", " + DateObj.getMinutes() + ", " + DateObj.getSeconds() + "),\n");
                    buildString += ("\tallDay: false\n");
                    buildString += "}"
                }
                // next element to check is 2 onward. 0 in callback represents no error
                callback(buildString, count+2, 0);
            }
            // the next key is a sign in and on a different day.
            // meaning that they did not sign out correctly.
            // send it to 12 PM, need to check here for the next sign in on that day
            else if(KeysDict[Keys[count + 1]] == "1") {
                var StartDay = new Date(parseInt(Keys[count],10));
                var EndDay = new Date(parseInt(Keys[count + 1],10));
                // if the date is not the same.
                if(StartDay.getDate() != EndDay.getDate()) {
                    console.log("User did not sign out!")
                
                    // fill start
                    var DateObj = new Date(parseInt(Keys[count],10));
                    buildString += "{\n"
                    buildString += "\ttitle: \'Work\',\n";
                    buildString += ("\tstart: new Date(" + DateObj.getFullYear()
                            + ", " + DateObj.getMonth() + ", " + DateObj.getDate()
                            + ", " + DateObj.getHours() + ", " + DateObj.getMinutes() + ", " + DateObj.getSeconds() + "),\n");

                    // return a differnt count, so it only shifts 1
                    DateObj = new Date(parseInt(Keys[count],10));
                    buildString += ("\tend: new Date(" + DateObj.getFullYear() 
                            + ", " + DateObj.getMonth() + ", " + DateObj.getDate() 
                            + ", 23" + ", 0" + "),\n");
                    buildString += ("\tallDay: false\n");
                    buildString += "}"
                    // as the next element is a sign in, only move 1 ahead, 1 in the callback
                    // represents a warning
                    callback(buildString, count+1, 1);
                }
                // the date is the same, bug, for now just end at that time
                else {
                    // if there is not enough distance between the two times ignore.
                    try {
                        // eject the entry from the list.
                        var index = Keys.indexOf(Keys[count+1]);
                        if (index > -1) {
                            Keys.splice(index, 1);
                        }
                    } catch(err) {
                        console.log("error");
                    }

                    // as the next element is a sign in, only move 1 ahead, 1 in the callback
                    // represents an error
                    callback(buildString, count, 2);
                }
            }
            
        } catch(err) {
            console.log("Error: " + err);
        }
    } else {
        console.log("Something went funky")
        // 2 in callback represents error
        callback(buildString, count+1, 2)
    }
}

/**
 * Function to alter the html document of the calendar, and serv it to the user. this calendar will
 * be interactin in the sense that the user can flick through days and all there data will be there
 * no need to fetch later dayz
 * @param  {string}   Hash        the users card hash
 * @param  {string}   buildString the html document
 * @param  {object}   req         the users request object
 * @param  {object}   res         the users result object
 * @param  {Function} callback    callbcak to the code
 * @return {null}                 none
 */
function buildCalendar(Hash, buildString, req, res, callback) {
    Hash += "_doorLog";
    // get all entries from the hash log.
    getAllFromHash2(Hash, i, function(Result, SortedKeys, count) {
        // if successfull.
        if(SortedKeys != null) {
            // resolve the users name and replace the title.
            var basehash = Hash.toString().split("_")[0];
            getFromHash(basehash, "First", function(Hue,err) {
                buildString = buildString.replace("%NAME%", Hue);
                // start building the string full of events.
                var replaceString = "";
                var counter = 0;
                console.log("Array Length: " + SortedKeys.length);
                while(counter < (SortedKeys.length+1)) {
                    console.log("Checking: " + counter);
                    fillEvents(replaceString, counter, SortedKeys, Result, function(Hue,next,error) {
                        counter = next;
                        // if error is not 2
                        if(error != 2) {
                            if(Hue != null) {
                                replaceString = Hue;
                            }
                            if(counter >= (SortedKeys.length-1)) {
                                // do callback
                                replaceString += "\n";
                                buildString = buildString.replace("%REPLACE%", replaceString);
                                //console.log("done with val: " + buildString);
                                callback(buildString);
                                counter += 10;
                            } else {
                                replaceString += ",\n";
                            }
                        }
                    });
                }
            });
        } else {
            servMessage("ERROR!", req, res, "The Hash returned was:", "NULL ", "This is caused becasuse the user had not get rescanned there card after registration");
        }
    });
}

/**
 * function to server a select number of pages to the user, this function
 * is probably redundant now as this could be incorperated into the main
 * function
 * @param  {string} pageaddr
 * @param  {object} req
 * @param  {object} res
 * @param  {object} decode
 * @param  {string} rfidTag
 * @return {null}
 */
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
                                            <form action='fullcalendar-1.6.4/demos/agenda-views.html_%CARDRFID%' method='post' target = '_blank'>\
                                                <br>\
                                                <label>Timesheet: </label><br>\
                                                <input type='submit'>\
                                            </form>\
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
 
/**
 * function that is the main html page server
 * it also deals with get and post requirest, also is the root
 * from which all other functions are called.
 * @param  {object} req
 * @param  {object} res
 * @return {null}
 */
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
        } else if(fileName.toString().search("table_round.html") == 1) {
            console.log("serving timesheet to user");
            var rfidTag = null;
            // get the RFID Tag, for redis
            rfidTag = fileName.toString().split("/")[2];
            fileName = "/table_round.html";
            content = localFolder + fileName;//setup the file name to be returned
            fs.readFile(content,function(err,contents){
                if(!err){
                    if(rfidTag != null) {
                        buildTable(rfidTag, contents.toString(), req, res, function(Hue) {
                            //console.log("Done: " + Hue);
                            res.end(Hue);
                        });
                    } else {
                        servMessage("ERROR!", req, res, "RFIDTAG was ", "NULL", "Stop trying to mess with my system!");
                    }                  
                } else {
                    console.dir(err);

                    //if the file was not found, set a 404 header...
                    res.writeHead(404, {'Content-Type': 'text/html'});
                    //send a custom 'file not found' message
                    //and then close the request
                    res.end('<h1>Sorry, the page you are looking for cannot be found.</h1>');
                };
            });
        } else if(fileName.toString().search("fullcalendar-1.6.4/demos/agenda-views.html") == 1) {
            console.log("serving calendar");
            var rfidTag = null;
            // get the RFID Tag, for redis
            rfidTag = fileName.toString().split("_")[1];
            fileName = "/fullcalendar-1.6.4/demos/agenda-views.html";
            content = localFolder + fileName;//setup the file name to be returned
            console.log("rfidTag is: " + rfidTag);
            fs.readFile(content,function(err,contents){
                if(!err){
                    if(rfidTag != null) {
                        buildCalendar(rfidTag, contents.toString(), req, res, function(Hue) {
                            res.end(Hue);
                        }); 
                    } else {
                        servMessage("ERROR!", req, res, "RFIDTAG was ", "NULL", "Stop trying to mess with my system!");
                    }                  
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
        else if(fileName == "/manageusers.html") {
            
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
                                                        <form id='%CARDRFID%_form' action='manageSubmit.html/%CARDRFID%' method='post' target = '_self'>\
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
        } else if (fileName.toString().search("manageSubmit.html") == 1) {
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