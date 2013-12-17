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
tmp3=/tmp/mirror3.$$
tmp4=/tmp/mirror4.$$
tmps="$tmp1 $tmp2 $tmp3 $tmp4"
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
recipients="mum@email.com,dad@email.com"
mail_config="-f imac@email.com -s smtp.server.com -xu mail_user -xp mail_password"
## linux only
mirror="/dev/hidraw0"
## osx only
dvoice="Deranged"
NODE=/usr/local/bin/node
NODE_PATH=/Users/davidwrigley/node_modules
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
message=$(echo ${inmsg} | sed -e "s;<name>;$name;")
saymessage=$(echo ${insmsg} | sed -e "s;<sname>;$sname;")
elif [ "$mode" = "OUT" ]; then
message=$(echo ${outmsg} | sed -e "s;<name>;$name;")
saymessage=$(echo ${outsmsg} | sed -e "s;<sname>;$sname;")
else
continue
fi

echo "${message}"
sendNotification -t ${recipients} -u "${message}" -m "$(date '+%x %X') ${message}"
if [ "$(which say 2>/dev/null)" != "" ]; then
echo "say ${saymessage}"
say -v ${voice} "${saymessage}"
fi
done
echo "wait $sec seconds"
sleep $sec
done
}

function sendNotification
{
chmod 777 $tmp3
$tmp3 ${mail_config} $* &
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
        console.log("Tag On");
        client.publish('gumballrfid', data);
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

#-----------
#
# Mir:ror SendEmail
#
# copied sendEmail (sendEmail-v1.56.tar) code source then:
# - searched \ and replaced with \\
# - searched ` and replaced with \`
# - searched $ and replaced with \$
#
#--------------------------

cat > $tmp3 << EOF
#!/usr/bin/perl -w
##############################################################################
## sendEmail
## Written by: Brandon Zehm <caspian@dotconf.net>
##
## License:
##  sendEmail (hereafter referred to as "program") is free software;
##  you can redistribute it and/or modify it under the terms of the GNU General
##  Public License as published by the Free Software Foundation; either version
##  2 of the License, or (at your option) any later version.
##  When redistributing modified versions of this source code it is recommended
##  that that this disclaimer and the above coder's names are included in the
##  modified code.
##
## Disclaimer:
##  This program is provided with no warranty of any kind, either expressed or
##  implied.  It is the responsibility of the user (you) to fully research and
##  comprehend the usage of this program.  As with any tool, it can be misused,
##  either intentionally (you're a vandal) or unintentionally (you're a moron).
##  THE AUTHOR(S) IS(ARE) NOT RESPONSIBLE FOR ANYTHING YOU DO WITH THIS PROGRAM
##  or anything that happens because of your use (or misuse) of this program,
##  including but not limited to anything you, your lawyers, or anyone else
##  can dream up.  And now, a relevant quote directly from the GPL:
##
## NO WARRANTY
##
##  11. BECAUSE THE PROGRAM IS LICENSED FREE OF CHARGE, THERE IS NO WARRANTY
##  FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.  EXCEPT WHEN
##  OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES
##  PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED
##  OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
##  MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.  THE ENTIRE RISK AS
##  TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU.  SHOULD THE
##  PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING,
##  REPAIR OR CORRECTION.
##
##############################################################################
use strict;
use IO::Socket;


########################
##  Global Variables  ##
########################

my %conf = (
    ## General
    "programName"          => \$0,                                  ## The name of this program
    "version"              => '1.56',                              ## The version of this program
    "authorName"           => 'Brandon Zehm',                      ## Author's Name
    "authorEmail"          => 'caspian@dotconf.net',               ## Author's Email Address
    "timezone"             => '+0000',                             ## We always use +0000 for the time zone
    "hostname"             => 'changeme',                          ## Used in printmsg() for all output (is updated later in the script).
    "debug"                => 0,                                   ## Default debug level
    "error"                => '',                                  ## Error messages will often be stored here
    
    ## Logging
    "stdout"               => 1,
    "logging"              => 0,                                   ## If this is true the printmsg function prints to the log file
    "logFile"              => '',                                  ## If this is specified (form the command line via -l) this file will be used for logging.
    
    ## Network
    "server"               => 'localhost',                         ## Default SMTP server
    "port"                 => 25,                                  ## Default port
    "bindaddr"             => '',                                  ## Default local bind address
    "alarm"                => '',                                  ## Default timeout for connects and reads, this gets set from \$opt{'timeout'}
    "tls_client"           => 0,                                   ## If TLS is supported by the client (us)
    "tls_server"           => 0,                                   ## If TLS is supported by the remote SMTP server
    
    ## Email
    "delimiter"            => "----MIME delimiter for sendEmail-"  ## MIME Delimiter
                              . rand(1000000),                     ## Add some randomness to the delimiter
    "Message-ID"           => rand(1000000) . "-sendEmail",        ## Message-ID for email header
    
);


## This hash stores the options passed on the command line via the -o option.
my %opt = (
    ## Addressing
    "reply-to"             => '',                                  ## Reply-To field
    
    ## Message
    "message-file"         => '',                                  ## File to read message body from
    "message-header"       => '',                                  ## Additional email header line(s)
    "message-format"       => 'normal',                            ## If "raw" is specified the message is sent unmodified
    "message-charset"      => 'iso-8859-1',                        ## Message character-set
    "message-content-type" => 'auto',                              ## auto, text, html or an actual string to put into the content-type header.
    
    ## Network
    "timeout"              => 60,                                  ## Default timeout for connects and reads, this is copied to \$conf{'alarm'} later.
    "fqdn"                 => 'changeme',                          ## FQDN of this machine, used during SMTP communication (is updated later in the script).
    
    ## eSMTP
    "username"             => '',                                  ## Username used in SMTP Auth
    "password"             => '',                                  ## Password used in SMTP Auth
    "tls"                  => 'auto',                              ## Enable or disable TLS support.  Options: auto, yes, no
    
);

## More variables used later in the program
my \$SERVER;
my \$CRLF        = "\\015\\012";
my \$subject     = '';
my \$header      = '';
my \$message     = '';
my \$from        = '';
my @to          = ();
my @cc          = ();
my @bcc         = ();
my @attachments = ();
my @attachments_names = ();

## For printing colors to the console
my \${colorRed}    = "\\033[31;1m";
my \${colorGreen}  = "\\033[32;1m";
my \${colorCyan}   = "\\033[36;1m";
my \${colorWhite}  = "\\033[37;1m";
my \${colorNormal} = "\\033[m";
my \${colorBold}   = "\\033[1m";
my \${colorNoBold} = "\\033[0m";

## Don't use shell escape codes on Windows systems
if (\$^O =~ /win/i) {
    \${colorRed} = \${colorGreen} = \${colorCyan} = \${colorWhite} = \${colorNormal} = \${colorBold} = \${colorNoBold} = "";
}

## Load IO::Socket::SSL if it's available
eval    { require IO::Socket::SSL; };
if (\$@) { \$conf{'tls_client'} = 0; }
else    { \$conf{'tls_client'} = 1; }






#############################
##                          ##
##      FUNCTIONS            ##
##                          ##
#############################



###############################################################################################
##  Function: initialize ()
##  
##  Does all the script startup jibberish.
##  
###############################################################################################
sub initialize {

    ## Set STDOUT to flush immediatly after each print  
    \$| = 1;
    
    ## Intercept signals
    \$SIG{'QUIT'}  = sub { quit("EXITING: Received SIG\$_[0]", 1); };
    \$SIG{'INT'}   = sub { quit("EXITING: Received SIG\$_[0]", 1); };
    \$SIG{'KILL'}  = sub { quit("EXITING: Received SIG\$_[0]", 1); };
    \$SIG{'TERM'}  = sub { quit("EXITING: Received SIG\$_[0]", 1); };
  
    ## ALARM and HUP signals are not supported in Win32
    unless (\$^O =~ /win/i) {
        \$SIG{'HUP'}   = sub { quit("EXITING: Received SIG\$_[0]", 1); };
        \$SIG{'ALRM'}  = sub { quit("EXITING: Received SIG\$_[0]", 1); };
    }
    
    ## Fixup \$conf{'programName'}
    \$conf{'programName'} =~ s/(.)*[\\/,\\\\]//;
    \$0 = \$conf{'programName'} . " " . join(" ", @ARGV);
    
    ## Fixup \$conf{'hostname'} and \$opt{'fqdn'}
    if (\$opt{'fqdn'} eq 'changeme') { \$opt{'fqdn'} = get_hostname(1); }
    if (\$conf{'hostname'} eq 'changeme') { \$conf{'hostname'} = \$opt{'fqdn'}; \$conf{'hostname'} =~ s/\\..*//; }
    
    return(1);
}


