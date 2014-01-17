import httplib
import urllib

params = urllib.urlencode({'field1': 20, 'key':'SFO8ZXONCWBCCWWH'})
headers = {"Content-type": "application/x-www-form-urlencoded","Accept": "text/plain"}
try:
	conn = httplib.HTTPConnection("winter.ceit.uq.edu.au:3000")
	conn.request("POST", "/update", params, headers)
	response = conn.getresponse()
	print response.status, response.reason
	data = response.read()
	conn.close()
except:
	pass