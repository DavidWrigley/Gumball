import os
import sys
import time
import redis
import datetime
import logging
import operator

# globals  
global r_server
global hours
global minutes

# connect
def connect():
	global r_server
	try:		
		# connect to Redis
		r_server = redis.StrictRedis(host='winter.ceit.uq.edu.au', port=6379, db=10, password=None, socket_timeout=None, connection_pool=None, charset='utf-8', errors='strict', decode_responses=False, unix_socket_path=None)

	except Exception, e:
		logging.error("Connection Issues")
		# need to retry this, as if it does not connect it will not run again till next morning.
		logging.error(e)

def getRegisteredUsers():
	global r_server
	users = r_server.lrange("Registered", 0, -1)
	return users

def checkUserLogout(user):
	global r_server
	userLogHash = user + "_doorLog"
	userHashValues = r_server.hgetall(userLogHash)
	if userHashValues:
		sortedUserHashValues = sorted(userHashValues.iteritems(), key=operator.itemgetter(0))

		if sortedUserHashValues:

			print sortedUserHashValues
			# if the last entry in the array of lists is 1 that means the user has not yet signed off.
			# so sign them off.
			if(sortedUserHashValues[-1][1] == '1'):
				logging.info("User: " + user + " is being automaticly signed off!")
				ts = (time.time()*1000)
				r_server.hset(userLogHash,int(ts),0)
			else:
				logging.info("User: " + user + " signed off correctly!")

# start
if __name__ == "__main__":

	global hours
	global minutes

	logging.basicConfig(filename='logout.log',format='%(asctime)s %(message)s', datefmt='%m/%d/%Y %I:%M:%S %p', level=logging.DEBUG)
	logging.info('Script Started!')

	hours = (12 + 5)
	minutes = 30

	#  Get date -- email will always be sent on the same day
	year = int(time.strftime("%Y"))
	month = int(time.strftime("%m"))
	day = int(time.strftime("%d"))
	# Seconds will always be 0
	seconds = int(0)
	# Get time and date of send in a single value
	set_date = datetime.datetime(year, month, day, hours, minutes, seconds)
	# Convert time and date to epoch seconds 
	set_epoch = (time.mktime(set_date.timetuple()))
	# Get Current Epoch
	current_time = datetime.datetime.now()
	current_epoch = (time.mktime(current_time.timetuple()))

	logging.info("the current time is: " + str(current_epoch))
	logging.info("the desired time is: " + str(set_epoch))

	"""
	while(current_epoch < set_epoch):
		current_time = datetime.datetime.now()
		current_epoch = (time.mktime(current_time.timetuple()))
		time.sleep(.5)
	"""

	logging.info("Script now running")
	# connect redis
	connect()

	# get all registered users keys
	users = getRegisteredUsers()

	# for each users, getall hash values for the doorlog and check that they have signed out.
	for a in users:
		checkUserLogout(a)

	logging.info("Script Finished!")

	# need to sleep for the rest of the day, then exit some time next morning.
	hoursRemaining = (24 - hours)+1
	logging.info("sleeping for: " + str(hoursRemaining))
	time.sleep(hoursRemaining*60*60)

	logging.info("Exiting! awaiting restart")
	# exit with error so supervisor d restarts it.
	sys.exit(1)