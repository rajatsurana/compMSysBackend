var express    = require('express');
var bodyParser = require('body-parser');
var app        = express();
var morgan     = require('morgan');
var mongoose   = require('mongoose');
var router = express.Router();
var config = require('./config');
var passport = require('passport');
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var LocalStrategy   = require('passport-local').Strategy;
var User   = require('./models/user');
var Vote  = require('./models/vote');
var Complaint = require('./models/complaint');// get our mongoose model
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('tiny'))
app.use(passport.initialize());
mongoose.connect(config.database);
app.set('superSecret', config.secret);

var mosca = require('mosca')
var mqtt = require('mqtt')
var ascoltatore = {
  //using ascoltatore
  type: 'mongo',
  url: config.database,
  pubsubCollection: 'ascoltatori',
  mongo: {}
};

var moscaSettings = {
  port: 1883,
  backend: ascoltatore,
  persistence: {
    factory: mosca.persistence.Mongo,
    url: config.database
  }
};
var settings = {
  port: 1883,
  persistence: mosca.persistence.Memory
};
var server = new mosca.Server(moscaSettings);

server.on('ready', setup);
server.published = function(packet, client, cb) {
  if (packet.topic.indexOf('echo') === 0) {
    return cb();
  }

  var newPacket = {
    topic: 'echo/' + packet.topic,
    payload: packet.payload,
    retain: packet.retain,
    qos: packet.qos
  };

  console.log('newPacket', newPacket);

  server.publish(newPacket, cb);
}
server.on('clientConnected', function(client) {
    console.log('client connected', client.id+" rajat");

});

// fired when a message is received
server.on('published', function(packet, client) {
  console.log('Published', packet.payload+"");

});
// fired when a client subscribes to a topic
server.on('subscribed', function(topic, client) {
  console.log('subscribed : ', topic);
});

// fired when a client subscribes to a topic
server.on('unsubscribed', function(topic, client) {
  console.log('unsubscribed : ', topic);
});

// fired when a client is disconnecting
server.on('clientDisconnecting', function(client) {
  console.log('clientDisconnecting : ', client.id);
});

// fired when a client is disconnected
server.on('clientDisconnected', function(client) {
  console.log('clientDisconnected : ', client.id);
});
// fired when the mqtt server is ready
function setup() {
  console.log('Mosca server is up and running')
}

app.get('/setup', function(req, res) {
  // create sample users
  var rajat = new User({
    email: 'Rajat',
    password: 'pass'
  });
  var ujjawal = new User({
    email: 'Ujjawal',
    password: 'pass2'
  });
  // save the sample users
  rajat.save(function(err) {
    if (err) throw err;

    console.log('User1 saved successfully');
    res.json({ success: true });
  });
  ujjawal.save(function(err) {
    if (err) throw err;

    console.log('User2 saved successfully');
    res.json({ success: true });
  });
});
passport.use('local-login',new LocalStrategy(
    {
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : false
    },
    function(email, password, done)
    {
        User.findOne({ 'email': email }, function(err, user)
        {
            console.log('rajat: '+email + user.password);
            if (err) {
                //console.log('rajat: '+err);
                return done(err); }
            if (!user)
            {

                return done(null, false, { message: 'Incorrect username.' });
            }
            if (!user.validPassword(password))
            {
                //console.log('rajat: Incorrect pass');
                return done(null, false, { message: 'Incorrect password.' });
            }
            return done(null, user);
        });
    }
));
router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});
/*
router.route('/login')
.post(function(req, res) {
  User.findOne({email:req.body.email}, function(err, user) {
      if(user!=null){
          if(user.password==req.body.password){
              res.json({message:'success', user:user, token:"token"});
          }else{
              res.json({message:'username or password not match'});
          }
      }else{
          res.json({message:'user not exist'});
      }
  });
);
*/
router.post('/login', function(req, res, next)
{
    passport.authenticate('local-login', function(err, user, info) {
        if (err) { return next(err) }
        if (!user) {
            return res.json(401, { error: 'No user found. Pl0x Sign up' });
        }

        var token = jwt.sign(user, app.get('superSecret'), {
            expiresIn: 24*60*60 // expires in 24 hours
        });
        res.json({ token : token, user:user});

    })(req, res, next);
});

router.use(function(req, res, next)
{
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (token) {
        // verifies secret and checks exp
        jwt.verify(token, app.get('superSecret'), function(err, decoded) {
            if (err) {
                return res.json({ success: false, message: 'Failed to authenticate token.' });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });

    } else {
        // if there is no token
        // return an error
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });

    }
});

router.route('/users')
.get( function(req, res) {
  User.find({}, function(err, users) {

    res.json({Users : users});
  });
})
.post( function(req, res) {
    User.findOne({email:req.body.email}, function(err, userN) {
        if (err)
        {
            res.send(err)
        }
        if (userN==null){
            var user = new User();
                  user.email = req.body.email || 'default',
                  user.password = user.generateHash(req.body.password) || 'default',
                  user.hostel=req.body.hostel||'default',
                  user.category=req.body.category||'default',
                  user.whoCreated=req.body.whoCreated||'default'
            user.save(function(err) {
                if (err){
                    res.send(err);
                }

                res.json({ message: 'user created', user: user});
            });
        }else{
            res.json({message:'user already exists'});
        }
    });
});

router.route('/findUser')
.post( function(req, res) {

  User.findOne({email:req.body.email}, function(err, user) {
      if (err)
      {
          res.send(err)
      }
      if(user!=null){
          res.json({message:'user found',user:user});
      }else{
          res.json({message:'user not exist'});
      }
  });
});

router.route('/deleteUser')
.post(function(req, res)
{
    User.findOne({email:req.body.email,password:user.generateHash(req.body.password)}, function(err, user) {
        if (err)
        {
            res.send(err)
        }
        if(user!=null){
        user.remove(function(err) {
            if (err) throw err;
        res.json({message:'User successfully deleted!'});
        });
        }else{
            res.json({message:'Username or password incorrect'});
        }
    });
});
router.route('/myComplaints')
.post(function(req, res)
{
    Complaint.find({userId:req.body.userId}, function(err, complaints) {
        if (err)
        {
            res.send(err)
        }
        if(complaints.length!=0){//complaints!=null

            res.json({message:'complaints found', complaints:complaints});
        }else{
            res.json({message:'no complaints found'});
        }
    });
});

router.route('/newComplaint')
.post(function(req, res)
{
    var complaint = new Complaint();
          complaint.userId = req.body.userId || 'default',
          complaint.solver = req.body.solver || 'Other',
          complaint.place = req.body.place||'default',
          complaint.description = req.body.description||'default',
          complaint.imageUrl = req.body.imageUrl||'default',
          complaint.status = 'Filed',
          complaint.topics= req.body.topics//JSON.parse(req.body.topics)

    complaint.save(function(err) {
        if (err){
            res.send(err);
        }
        //create voteObject************************************if not personal
        if(complaint.solver== 'Warden' || 'Dean'){
            var vote= new Vote();
              vote.complaintId=complaint._id;
              vote.canVote=true;
              vote.up=0;
              vote.down=0;
              vote.userVotesArr=[];
              vote.save(function(err){
                  if (err){
                      res.send(err);
                  }
                  res.json({ message: 'complaint created', complaint: complaint, vote:vote});
              });
        }else{
            res.json({ message: 'complaint created', complaint: complaint});
        }


    });
});
router.route('/searchComplaints')
.post(function(req, res)
{
    Complaint.find({topics:req.body.topic}, function(err, complaints) {
        if (err)
        {
            res.send(err)
        }
        if(complaints!=null){

            res.json({message:'complaints found', complaints:complaints});
        }else{
            res.json({message:'no complaints found'});
        }
    });
});

router.route('/changeComplaintStatus')
.post(function(req, res)
{
    Complaint.findOne({ _id:req.body.complaintId}, function(err, complaint) {
        if (err)
        {
            res.send(err)
        }
        if(complaint!=null){
            complaint.status=req.body.status;
            complaint.save(function(err) {
                if (err){
                    res.send(err);
                }

                res.json({ message: 'status updated', status:complaint.status});
            });
        }else{
            res.json({message:'no complaint found'});
        }
    });
});
router.route('/complaintDescription')
.post(function(req, res)
{
    Complaint.findOne({ _id:req.body.complaintId}, function(err, complaint) {
        if (err)
        {
            res.send(err)
        }
        if(complaint!=null){
            res.json({message:'complaint found',complaint:complaint});
        }else{
            res.json({message:'no complaint found'});
        }
    });
});
router.route('/deleteComplaint')
.post(function(req, res)
{
    Complaint.findOne({ _id:req.body.complaintId, userId:req.body.userId}, function(err, complaint) {
        if (err)
        {
            res.send(err)
        }
        if(complaint!=null){
        complaint.remove(function(err) {
            if (err) throw err;
        res.json({message:'Complaint successfully deleted!'});
        });
        }else{
            res.json({message:'Complaint not exist'});
        }
    });
});
router.route('/vote')
.post(function(req, res)
{
    Vote.findOne({ complaintId:req.body.complaintId}, function(err, vote) {
        if (err)
        {
            res.send(err)
        }
        if(vote!=null){
            if(vote.canVote==true){
                var voted=false;
                for(var z=0; z<vote.userVotesArr.length;z++){
                    if(vote.userVotesArr[z].userId==req.body.userId){
                        voted=true;
                        if(vote.userVotesArr[z].upVote==true){
                            if(req.body.upVote=='false'){
                                vote.userVotesArr[z].upVote=false;
                                vote.down++;
                                vote.up--;
                            }else{
                                //vote.userVotesArr[z].upVote=true;
                                //vote.up++;
                                //vote.down--;
                            }
                        }else{
                            if(req.body.upVote=='true'){
                                vote.userVotesArr[z].upVote=true;
                                vote.down--;
                                vote.up++;
                            }else{
                                //vote.userVotesArr[z].upVote=true;
                                //vote.up++;
                                //vote.down--;
                            }
                        }
                        break;
                    }
                }
                if(voted==false){
                    if(req.body.upVote=='true'){
                        vote.up++;
                        vote.userVotesArr.push({userId:req.body.userId,upVote:true});
                    }else{
                        vote.down++;
                        vote.userVotesArr.push({userId:req.body.userId,upVote:false});
                    }
                }
                vote.save(function(err) {
                    if (err){
                        res.send(err);
                    }

                    res.json({ message: 'voted', vote: vote});
                });
            }else{
                res.json({message:'voting over'});//if canVote==false
            }
        }else{
            res.json({message:'no voting started'});
        }
    });
});
router.route('/voteStatusChange')
.post(function(req, res)
{
    Vote.findOne({ complaintId:req.body.complaintId}, function(err, vote) {
        if (err)
        {
            res.send(err)
        }
        if(vote!=null){
            if(req.body.canVote=='true'){
                vote.canVote=true;
            }else{
                vote.canVote=false;
            }
            vote.save(function(err) {
                if (err){
                    res.send(err);
                }

                res.json({ message: 'status changed', vote: vote});
            });
        }else{
            res.json({message:'no voting started'});
        }
    });
});

/*
router.route('/changePersonalComplaintStatus')
.post(function(req, res)
{
    Complaint.findOne({ _id:req.body.complaintId}, function(err, complaint) {
        if (err)
        {
            res.send(err)
        }
        if(complaint!=null){
            complaint.status=req.body.status;
            complaint.save(function(err) {
                if (err){
                    res.send(err);
                }

                res.json({ message: 'status updated', status:complaint.status});
            });
        }else{
            res.json({message:'no complaint found'});
        }
    });
});
*/
app.use('/api', router);
app.listen(3000);
console.log('Magic happens on port 3000');