#!/bin/bash

#-----------
#
# File: mirror_osx.sh
# Author: Nico.
# Date: june 2012.
# License: GNU GPL.
# Supported OS: Linux (Fedora), OSX
#
#--------------------------
#
# usage: 
#     mirror_osx.sh # 'normal' mode
#     mirror_osx.sh email # test email
#     mirror_osx.sh echo # no action
#
#--------------------------

tmp1=/tmp/mirror1.$$
tmp2=/tmp/mirror2.$$
## tmp3=/tmp/mirror3.$$
tmp4=/tmp/mirror4.$$
## tmps="$tmp1 $tmp2 $tmp3 $tmp4"
tmps="$tmp1 $tmp2 $tmp4"
trap "rm -f $tmps; echo 'the end'; exit" 0 1 2 3 15
sec=3

#-----------
#
# Mir:ror user config
#
#--------------------------

## RFID tags
cat > $tmp2 << EOF
000008d00219a440cf1aff000000 Gregoire Trinoids
000008d0021a0352c31022000000 Garance Princess
EOF

## Messages
inmsg="<name> just checked-in"
insmsg="hello <sname>"
outmsg="<name> just checked-out"
outsmsg="good-bye <sname>"

## SendEmail config
##recipients="mum@email.com,dad@email.com"
##mail_config="-f imac@email.com -s smtp.server.com -xu mail_user -xp mail_password"
## linux only
mirror="/dev/hidraw0"
## osx only
dvoice="Deranged"
NODE=/usr/sbin/node
NODE_PATH=/home/pi/node_modules
export NODE_PATH

#----------------------------------------------------
#-- end user config ---------------------------------
#----------------------------------------------------


#-----------
#
# Mir:ror main program
#
#--------------------------

function main()
{
chmod 777 $tmp4
chmod 777 $tmp1

if [ "$*" = "email" ]; then
echo "test email"
message="test"
sendNotification -v -t ${recipients} -u "${message}" -m "$(date '+%x %X') ${message}"
wait $!
exit 0
fi

# magic OS selection
#-------------------------
if [ "$(uname)" == "Darwin" ]; then
cmd="$NODE $tmp4" ## osx
else
cmd="$tmp1" ## other (assume linux)
fi

# kill existing instances
#-------------------------
pids=$(ps -u$USER -opid -ocommand | grep "$(echo $cmd | sed -e 's;[0-9]*$;;g')" | grep -v grep | awk '{ print $1 }')
if [ "$pids" != "" ]; then
kill -INT ${pids}
fi

# actual loop
#-------------------------
while [ 1==1 ]; do
$cmd | while read line
do
NF=$(echo $line | awk '{ print NF }')
if [ $NF -ne 4 ]; then
echo "$line"
fi
if [ $NF -eq 1 -a "$line" = "again" ]; then
break
fi
if [ "$*" = "echo" ]; then
echo "$line"
continue
fi

tag=$(echo $line | awk '{ print $3 }')
mode=$(echo $line | awk '{ print $4 }')
name=$(grep $tag $tmp2 | awk '{ print $2 }')
voice=$(grep $tag $tmp2 | awk '{ print $3 }')
sname=${name}
if [ -s $name ]; then name=${tag}; fi
if [ -s $voice ]; then voice=${dvoice}; fi
#echo "$tag $mode"
if [ "$mode" = "IN" ]; then
# hash here
mosquitto_pub -h "winter.ceit.uq.edu.au" -t gumballrfid -m $name
message=$(echo ${inmsg} | sed -e "s;<name>;$name;")
saymessage=$(echo ${insmsg} | sed -e "s;<sname>;$sname;")
elif [ "$mode" = "OUT" ]; then
message=$(echo ${outmsg} | sed -e "s;<name>;$name;")
saymessage=$(echo ${outsmsg} | sed -e "s;<sname>;$sname;")
else
continue
fi

echo "${message}"
if [ "$(which say 2>/dev/null)" != "" ]; then
echo "say ${saymessage}"
say -v ${voice} "${saymessage}"
fi
done
echo "wait $sec seconds"
sleep $sec
done
}

#-----------
#
# Mir:ror node.js loop
#
#--------------------------
cat > $tmp4 << EOF
try {
var HID = require('node-hid');
var hexy = require('hexy');
var mqtt = require('mqtt');
var crypto = require('crypto');
var shasum = crypto.createHash('sha1');

client = mqtt.createClient(1883, 'winter.ceit.uq.edu.au');

client.publish('gumballlog', "RFID Tag Reader Connected");

var devices = new HID.devices(7592, 4865);
var hid;
if (!devices.length) {
  console.log("No mir:ror found");
} else {
  hid = new HID.HID(devices[0].path);
//  hid.write([03, 01]); //Disable sounds and lights
  hid.read(onRead);
}
} catch (err) {
console.log("Error:", err)
console.log("Again")
}

var data;

function hashIt(dataIn, callback) {
    var hash = crypto.createHash('md5').update(dataIn).digest('hex');
    callback(hash);
}

function onRead(error, data) {
  var size;
  var id;

  //get 64 bytes
  if (data[0] != 0) {
    
    //console.log("\n" + data.map(function (v) {return ('00' + v.toString(16)).slice(-2)}).join(','));

    var myhex = hexy.hexy(data);

    switch (data[0]) {
    case 1:
      //Orientation change
      switch (data[1]) {
      case 4:
        console.log("-> mir:ror up");
        break;
      case 5:
        console.log("-> mir:ror down");
        break;
      }
      break;
    case 2:
      //RFID
      size = data[4];

      switch (data[1]) {
      case 1:
        hashIt(data.toString(), function(Result) {
            console.log("Tag On Hash: " + Result);
            client.publish('gumballrfid', Result);
        });
        break;
      case 2:
        console.log("Tag OFF");
        break;
      }

      break;
    }
  }
  hid.read(onRead);
}
EOF

#-----------
#
# Mir:ror python loop
#
#--------------------------
cat > $tmp1 << EOF
#!/usr/bin/python
# -*- coding: utf-8 -*-
 
import binascii
import time
import sys

mirror="${mirror}"

while 1:
	try:
		# Opening mirror.
		mirror = open(mirror, "rb")
		
		while 1:
			donnee = mirror.read(16)
			if donnee != '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00':
				rfid_id = binascii.hexlify(donnee)[4:]
				if donnee[0:2] == '\x02\x01': # Tag detected
					print "Tag identified %s IN " % rfid_id
				sys.stdout.flush()
		
			elif donnee[0:2] == '\x02\x02': # Tag removed
				print "Tag identified %s OUT " % rfid_id
				sys.stdout.flush()
		
	except :
		print "could not open mir:ror (%s)..." % mirror
		sys.stdout.flush()
		time.sleep(5)

EOF

main $*



rm -f $tmps
