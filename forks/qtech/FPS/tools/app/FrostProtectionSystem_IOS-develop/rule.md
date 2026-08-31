{
  "rules": {
    "users" : {
      "$user_id": {
        ".read": "$user_id == auth.uid",
        ".write": "$user_id == auth.uid && newData.hasChildren(['user_name', 'email'])",
        "user_name": {
          ".validate": "newData.isString() && newData.val() != ''"
        },
        "email": {
          ".validate": "auth.token.email === newData.val()",
        },
        "gateways": {
          ".validate": "newData.hasChildren()",
          "$gateway_id": {
          	".validate": "newData.parent().parent().parent().parent().child('gateways').child($gateway_id).child('owner').val() == $user_id &&
            newData.hasChildren(['name'])",
            "name": {
              ".validate": "newData.val() == newData.parent().parent().parent().parent().parent().child('gateways').child($gateway_id).child('name').val()"
            },
            "devices": {
              ".validate": "newData.hasChildren()",
              "$device_id": {
                ".validate": "newData.parent().parent().parent().parent().parent().parent().child('gateways').child($gateway_id).child('devices').child($device_id).exists() && newData.isString()"
              }
            },
            "$other": { ".validate": false }
          }
        },
        "$other": { ".validate": false }
      }
    },
    "gateways" : {
      "$gateway_id": {
        ".read": "auth.uid == data.child('owner').val()",
        ".write": "(newData.hasChildren(['name','owner'])
        && (!data.child('owner').exists()
            || data.child('owner').val() == ''
            || data.child('owner').val() == auth.uid
            || newData.child('owner').val() == auth.uid))
        || !newData.exists()
        		&& data.child('owner').val() == auth.uid
        		&& !newData.parent().parent().child('users').child(data.child('owner').val()).child('gateways').child($gateway_id).exists() ",
        "public_key": { ".validate": "newData.isString()" },
        "name": { ".validate": "newData.isString()" },
        "GPS": {
          ".validate": "newData.hasChildren(['lat','long'])",
           "lat": { ".validate": "newData.isNumber()" },
           "long": { ".validate": "newData.isNumber()" },
        },
        "owner": {
          ".validate": "newData.parent().parent().parent().child('users').child(newData.val()).child('gateways').child($gateway_id).exists() &&
          (!data.exists() || !newData.parent().parent().parent().child('users').child(data.val()).child('gateways').child($gateway_id).exists())"
        },
        "command": { ".validate": "newData.isString()" },
        "devices": {
          ".validate": "newData.hasChildren()",
          "$device_id": {
            ".validate": "newData.hasChildren()",
            "lora_id": { ".validate": true },
            "TS": { ".validate": true },
            "name": { ".validate": true },
            "on": { ".validate": true },
            "GPS": { ".validate": true },
            "$other": { ".validate": false },
          }
        },
        "last_login": { ".validate": true },
        "$other": { ".validate": false },
      }
    },
    "devices" : {
      ".read": "auth != null",
      ".write": "auth != null",
      "$device_id": {
        ".validate": "newData.hasChildren()",
        "GPS": {
          ".validate": "newData.hasChildren(['lat','long'])",
           "lat": { ".validate": "newData.isNumber()" },
           "long": { ".validate": "newData.isNumber()" },
        },
        "name": { ".validate": "newData.isString()" },
        "lora_id": { ".validate": true },
        "owner": {
          ".validate": "newData.parent().parent().parent().child('gateways').child(newData.val()).child('devices').child($device_id).exists() &&
          (!data.exists() || !newData.parent().parent().parent().child('gateways').child(newData.val()).child('devices').child($device_id).exists())"
        },
        "owner_public_key": { ".validate": "newData.isString()" },
        "public_key": { ".validate": "newData.isString()" },
        "current_data": {
          ".validate": "newData.hasChildren()"
        },
        "$other": { ".validate": false },
      }
    },
  	"device_logs" : {
      ".read": "auth != null",
      ".write": "auth != null",
      "$device_id": {
        ".indexOn": ["TS"]
			}
    },
    "key": {
      ".read": true,
      ".write": false,
    },
    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
