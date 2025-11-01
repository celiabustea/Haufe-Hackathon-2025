// Example JavaScript with issues

function processData(data) {
  var result = [];  
  for (var i = 0; i < data.length; i++) {
    result[i] = data[i] * 2;
  }
  return result;
}

function getUserInfo(user) {
  
  let profile = {
    id: user.id,
    name: user.name
  };
  
  profile.created = new Date();
  return profile;
}


var globalCounter = 0;

function increment() {
  globalCounter++;
}
