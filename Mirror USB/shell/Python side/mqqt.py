#!/usr/bin/python
 
import mosquitto
import os
import sys
import time
import threading
import redis
import datetime
 
# globals  
global debug
global mqttc
global run
global r_server

# mqtt
broker = "winter.ceit.uq.edu.au"
port = 1883

# callback
def on_message(mosq, obj, msg):

	global mqqtc
	global debug
	global r_server

	# get the current number of unregisterd cards
	current_number = int(r_server.get("Number"));

	# check if card has been registed
#	if(r_server.hget(str(hexstring), "RFID") == None):
	if(r_server.hget(msg.payload, "RFID") == None):

		# check if they have not registed the card.
		current_unregisterd_dict = r_server.hgetall("Unregistered")
		for key, value in current_unregisterd_dict.iteritems():
#			if value == str(hexstring):
			if value == msg.payload:
				print "Card already in system, Unregistered"
				print "Go to winter.ceit.uq.edu.au/3000/index.html To Register"
				print "Your Key is: " + key
				return

		# This is the first time the card has been scanned
		# Enter it into the Unregisterd database
#		print "Card: " + str(hexstring) + " Awaiting Registration"
		print "Card: " + str(msg.payload) + " Awaiting Registration"

#		r_server.hset("Unregistered", current_number , str(hexstring))
		r_server.hset("Unregistered", current_number , str(msg.payload))


		print "Go to winter.ceit.uq.edu.au/3000/index.html To Register"
		print "Your Key is: " + str(current_number)

		# boost the number by one, so no overwrite
		r_server.set("Number", (current_number+1))

	# The Card is Registerd
	else:

		# update the time stamp
		ts = time.time()
		st = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')

#		r_server.hset(str(hexstring), "Python Time", ts)
#		r_server.hset(str(hexstring), "Human Time", str(st))

		r_server.hset(str(msg.payload), "Python Time", ts)
		r_server.hset(str(msg.payload), "Human Time", str(st))		

		# is it a registered card.
#		print "Card: " + str(hexstring) + " Registered\n" + "Hello: " + str(r_server.hget(str(hexstring), "First"))
#		print "Signed In: " + str(r_server.hget(str(hexstring), "Human Time"))

		print "Card: " + str(msg.payload) + " Registered\n" + "Hello: " + str(r_server.hget(str(msg.payload), "First"))
		print "Signed In: " + str(r_server.hget(str(msg.payload), "Human Time"))

		# if user has permission for lollies, dispense
#		if(int(r_server.hget(str(hexstring), "Lollies")) == 1):	
			# profit?
#			mqttc.publish("ait", hexstring)
#		else:
#			print "No lollies for you!"

		if(int(r_server.hget(str(msg.payload), "Lollies")) == 1):	
			# profit?
			mqttc.publish("ait", msg.payload)
		else:
			print "No lollies for you!"			

def on_disconnect():
	global mqttc
	mqttc.connect(broker, port)
	mqttc.publish("gumballlog", "RFID Parser Reconnected")
	mqttc.subscribe("gumballrfid", 0)
	mqttc.on_message = on_message

def heartbeat():
	global mqqtc
	global run
	while (run):
		mqttc.publish("gumballlog","RFID Parser Still Alive")
		time.sleep(10)

	return

def userInput():
	global run
	global debug
	time.sleep(1)
	while (run):
		userIn = raw_input()
		if(userIn == "debug"):
			if(debug):
				print "Debug Off"
				debug = 0
				continue
			else:
				print "Debug On"
				debug = 1
				continue
		if(userIn == "exit"):
			print "Program shutting down"
			run = 0
	return

# start
debug = 0
run = 1

# generate client name and connect to mqtt
mypid = os.getpid()
client_uniq = "pubclient_"+str(mypid)
mqttc = mosquitto.Mosquitto(client_uniq)
 
#connect to broker
mqttc.connect(broker, port, 20)

# publish log and subscribe
mqttc.publish("gumballlog", "RFID Parser Connected")
mqttc.subscribe("gumballrfid", 0)
mqttc.on_message = on_message

# Start using Redis
r_server = redis.Redis(host='winter.ceit.uq.edu.au', port=6379, db=10, password=None, socket_timeout=None, connection_pool=None, charset='utf-8', errors='strict', decode_responses=False, unix_socket_path=None)

# thread off to heart beat and input thread
heartbeatThread = threading.Thread(target = heartbeat)
inputThread = threading.Thread(target = userInput)

# start the threads
heartbeatThread.start()
inputThread.start()

print "\nthreads starting"

print """\n############ Commands ###########
# debug -- Switch Debug On/Off  # 
# exit --- Exit the Program     #
#################################\n"""
 
#remain connected and publish
while ((mqttc.loop() == 0) and (run)):
    if(debug):
    	print "loop"
    time.sleep(1)

print "Joining Heartbeat Thread"
heartbeatThread.join()
print "Joining UserInput Thread"
inputThread.join()

sys.exit("All Done, Bye")    