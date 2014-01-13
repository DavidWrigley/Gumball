#!/usr/bin/python
# gumball machine python script
################################
#    By David Wrigley, CEIT    #
################################
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
screenTopic = "gumballscreen"

# connect
def connect():
	global mqttc
	global r_server
	try:

		# connect to mqtt
		mqttc.reinitialise()
		mqttc.connect(broker, port, 20, True)
		mqttc.publish("rfidlog", "RFID Gumball Parser Re-Connected")
		mqttc.subscribe("rfid", 0)
		mqttc.on_message = on_message
		mqttc.on_disconnect = on_disconnect
		
		# connect to Redis
		r_server = redis.Redis(host='winter.ceit.uq.edu.au', port=6379, db=10, password=None, socket_timeout=None, connection_pool=None, charset='utf-8', errors='strict', decode_responses=False, unix_socket_path=None)
	
	except:
		print "Connection Problem, Exiting"
		sys.exit(1)

# callback
def on_message(mosq, obj, msg):

	global mqqtc
	global debug
	global r_server

	jsonString = json.loads(msg.payload)

	sourceId = jsonString["id"]
	hashkey = jsonString["value"]

	my_str = ""

	# check that the id of the scan is correct
	if(sourceId == "1.1.0"):
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
					mqttc.publish(screenTopic, my_str)
					print my_str
					return

			# This is the first time the card has been scanned
			# Enter it into the Unregisterd database
			r_server.hset("Unregistered", current_number , str(hashkey))


			my_str += "Unregistered Go to\nwinter.ceit.uq.edu.au\n:" + str(serverPort) + "/index.html\nTo Register\n"
			my_str += "Your Key is: " + str(current_number) + "\n"
			print my_str

			# publish here
			mqttc.publish(screenTopic, my_str)

			# boost the number by one, so no overwrite
			r_server.set("Number", (current_number+1))

		# The Card is Registerd
		else:

			# update the time stamp
			ts = time.time()
			st = datetime.datetime.fromtimestamp(ts).strftime('%d-%m-%Y %H:%M:%S')

			# set users most recent sign in time
			r_server.hset(str(hashkey), "Python Time", ts)
			r_server.hset(str(hashkey), "Human Time", str(st))		

			# add this touch to a list of sign in times. allowing for some nice graphics later.
			my_str = str(hashkey) + "_gumballLog"
			print my_str
			r_server.zadd(my_str, ts, 1)

			# reset the string
			my_str = ""

			# create string to send to screen
			my_str += "Card: " + str(hashkey)[0:10] + "\nRegistered!\n" + "Hello: " + str(r_server.hget(str(hashkey), "First"))
			my_str += "\nSigned In:\n" + str(r_server.hget(str(hashkey), "Human Time"))

			# if user has permission for lollies, dispense
			if(int(r_server.hget(str(hashkey), "Lollies")) == 1):	
				# profit?
				mqttc.publish("ait", str(hashkey))
			else:
				# no profit
				my_str += "\nNo lollies for you!"	

			my_str += "\n"

			# publish to screen
			mqttc.publish(screenTopic, my_str)
			print my_str

def on_disconnect(mosq, obj, rc):
	connect()
	time.sleep(10)

try:
	# wait for a little bit to not trip supervisord's fatel status
	print "Started"
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
except:
	# exit with error, supervisord will restart it.
	sys.exit(1)
