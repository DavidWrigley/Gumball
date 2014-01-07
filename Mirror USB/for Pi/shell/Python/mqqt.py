#!/usr/bin/python
 
import mosquitto
import os
import sys
import time
import redis
import datetime
import textwrap
import json
 
# globals  
global debug
global mqttc
global run
global r_server

# mqtt
broker = "winter.ceit.uq.edu.au"
port = 1883
serverPort = 55671

# connect
def connect():
	global mqttc
	global r_server
	try:

		# connect to mqtt
		mqttc.reinitialise()
		mqttc.connect(broker, port, 20, True)
		mqttc.publish("gumballlog", "RFID Parser Re-Connected")
		mqttc.subscribe("gumballrfid", 0)
		mqttc.on_message = on_message
		mqttc.on_disconnect = on_disconnect
		
		# connect to Redis
		r_server = redis.Redis(host='winter.ceit.uq.edu.au', port=6379, db=10, password=None, socket_timeout=None, connection_pool=None, charset='utf-8', errors='strict', decode_responses=False, unix_socket_path=None)
	except:
		print "Parser Problems, retrying"
		time.sleep(5)

# callback
def on_message(mosq, obj, msg):

	global mqqtc
	global debug
	global r_server

	jsonString = json.loads(msg.payload)

	sourceId = jsonString["id"]
	hashkey = jsonString["value"]

	my_str = ""

	# get the current number of unregisterd cards
	current_number = int(r_server.get("Number"));

	# check if card has been registed
	if(r_server.hget(hashkey, "RFID") == None):

		# check if they have not registed the card.
		current_unregisterd_dict = r_server.hgetall("Unregistered")
		for key, value in current_unregisterd_dict.iteritems():
			if value == hashkey:
				print "comparing: " + value + " to: " + hashkey 
				my_str = "Unregistered! Go to\nwinter.ceit.uq.edu.au\n:" + str(serverPort) + "/index.html\nTo Register\nYour Key is: " + key + "\n"
				print my_str

				# publish here
				mqttc.publish("gumballscreen", my_str)
				print my_str
				return

		# This is the first time the card has been scanned
		# Enter it into the Unregisterd database
		r_server.hset("Unregistered", current_number , str(hashkey))


		my_str += "Unregistered Go to\nwinter.ceit.uq.edu.au\n:" + str(serverPort) + "/index.html\nTo Register\n"
		my_str += "Your Key is: " + str(current_number) + "\n"
		print my_str

		# publish here
		mqttc.publish("gumballscreen", my_str)

		# boost the number by one, so no overwrite
		r_server.set("Number", (current_number+1))

	# The Card is Registerd
	else:

		# update the time stamp
		ts = time.time()
		st = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')

		r_server.hset(str(hashkey), "Python Time", ts)
		r_server.hset(str(hashkey), "Human Time", str(st))		

		# is it a registered card.
		my_str += "Card: " + str(hashkey)[0:10] + "\nRegistered!\n" + "Hello: " + str(r_server.hget(str(hashkey), "First"))
		my_str += "\nSigned In:\n" + str(r_server.hget(str(hashkey), "Human Time"))

		# if user has permission for lollies, dispense
		if(int(r_server.hget(str(hashkey), "Lollies")) == 1):	
			# profit?
			mqttc.publish("ait", str(hashkey))
		else:
			my_str += "\nNo lollies for you!"	

		my_str += "\n"

		# publish here
		mqttc.publish("gumballscreen", my_str)
		print my_str

def on_disconnect(mosq, obj, rc):
	connect()
	time.sleep(10)

# start
debug = 0
run = 1

# generate client name and connect to mqtt
mypid = os.getpid()
client_uniq = "pubclient_"+str(mypid)

# connect mqtt
mqttc = mosquitto.Mosquitto(client_uniq)
connect()

print """\n############  HELLO  ############
# ~~~~~~~ NOW RUNNING ~~~~~~~~  # 
#################################\n"""
 
#remain connected and publish
while (mqttc.loop() == 0):
	time.sleep(1)

# exit with error, supervisord will restart it.
sys.exit(1)
