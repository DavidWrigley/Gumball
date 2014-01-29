import mosquitto
import os
import sys
import time
import logging
from pylcdsysinfo import LCDSysInfo, TextLines, TextLines, BackgroundColours, TextColours, TextAlignment

global mqttc
global d

# mqtt
broker = "winter.ceit.uq.edu.au"
port = 1883
screenTopic = "doorscreen"

# screen
bg = BackgroundColours.BLACK
fg = TextColours.GREEN

# connect
def connect():
	global mqttc
	global d

	# display
	d.clear_lines(TextLines.ALL, bg)
	d.display_text_on_line(3, "Connecting!", False, TextAlignment.CENTRE, TextColours.CYAN)

	# mqtt
	mqttc = mosquitto.Mosquitto(client_uniq)
	mqttc.on_message = on_message
	mqttc.on_publish = on_publish
	mqttc.on_subscribe = on_subscribe
	mqttc.on_connect = on_connect
	mqttc.on_disconnect = on_disconnect
	mqttc.connect(broker, port)

def on_disconnect():
	logging.error("Disconnected From Broker.")
	d.clear_lines(TextLines.ALL, bg)
	d.display_text_on_line(3, "Retrying!", False, TextAlignment.CENTRE, TextColours.CYAN)

def on_connect(mosq, obj, rc):
	if rc == 0:
		logging.info("Connected to Broker.")
		d.clear_lines(TextLines.ALL, bg)
		d.display_text_on_line(3, "Ready", False, TextAlignment.CENTRE, TextColours.CYAN)
		mqttc.publish("gumballlog", "Screen Re-Connected")
		mqttc.subscribe(screenTopic, 0)
		mqttc.subscribe("rfid", 0)
	else:
		logging.error("Connection to Broker Failed.")

def on_subscribe(mosq, obj, mid, qos_list):
	logging.info("Subscribe with mid "+str(mid)+" received.")

def on_publish(mosq, obj, mid):
	logging.info("Message: " + str(mid) + " published")

# callback
def on_message(mosq, obj, msg):

	# grab globals
	global mqqtc
	global d

	# generate String
	my_str = ""

	# set screen parameters
	d.clear_lines(TextLines.ALL, bg)
	d.dim_when_idle(False)
	d.set_brightness(127)
	d.save_brightness(127, 255)
	d.set_text_background_colour(bg)

	# pull out the message
	my_str = msg.payload

	# log it
	logging.info(my_str)

	# go through the string till you hit a return
	# then print that line, so i can format it to look exact
	# each time
	prev_n = 0;
	lineCount = 0;
	for n in range(0,len(msg.payload)):
		if(my_str[n] == '\n'):
			d.display_text_on_line(lineCount+1, my_str[prev_n:n], False, TextAlignment.CENTRE, TextColours.CYAN)
			prev_n = n
			lineCount += 1
	return

try:
	# start the logger
	logging.basicConfig(filename='screen.log',format='%(asctime)s %(message)s', datefmt='%m/%d/%Y %I:%M:%S %p', level=logging.DEBUG)
	logging.info('Script Started!')

	# generate client name and connect to mqtt
	mypid = os.getpid()
	client_uniq = "pubclient_"+str(mypid)

	# set the screen up
	d = LCDSysInfo()
	d.clear_lines(TextLines.ALL, bg)
	d.dim_when_idle(False)
	d.set_brightness(127)
	d.save_brightness(127, 255)
	d.set_text_background_colour(bg)

	# connect mqtt
	connect()

	#remain connected and publis
	mqttc.loop_forever()

	# bad
	logging.info("Dropped out of the loop, Exiting")
	time.sleep(2)
	sys.exit(1)

except Exception, e:
	# exit with error, supervisord will restart it.
	d.clear_lines(TextLines.ALL, bg)
	d.display_text_on_line(3, "Error", False, TextAlignment.CENTRE, TextColours.CYAN)
	logging.error(e)
	logging.error(traceback.format_exc())
	time.sleep(10)
	sys.exit(1)	