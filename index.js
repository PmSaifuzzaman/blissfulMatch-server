const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const jwt = require('jsonwebtoken')
const cors = require('cors');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ublbqgg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const biodataCollection = client.db("blissfulMatchDB").collection("biodatas");
    const favouriteCollection = client.db("blissfulMatchDB").collection("favourites");
    const requestCollection = client.db("blissfulMatchDB").collection("requests");
    const manageUserCollection = client.db("blissfulMatchDB").collection("manageUsers");
    const ratingsCollection = client.db("blissfulMatchDB").collection("ratings");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    

    // Middlewares
    const verifyToken = (req, res, next) => {
      console.log('Decoded Token:', req.decoded);
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verifyToken before verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      // Ensure that req.decoded is set by verifyToken middleware
      if (!req.decoded || !req.decoded.ContactEmail) {
        return res.status(401).send({ message: 'unauthorized access' });
      }

      const email = req.decoded.ContactEmail;  // Use ContactEmail consistently
      const query = { email: email };
      const user = await manageUserCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };




    // Biodata related api
    // Get all biodatas
    app.get("/biodatas", async (req, res) => {
      const result = await biodataCollection.find().toArray();
      res.send(result);
    });

    // User related api
    app.get("/users", async (req, res) => {
      const result = await manageUserCollection.find().toArray();
      res.send(result)
    });

    // Get premium user by query
    app.get('/users/approvedPremium', async (req, res) => {
      const cursor = manageUserCollection.find({ MembershipType: 'Premium' }).sort({ Age: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // 
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      const query = { email: user.email }
      const existingUser = await manageUserCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await manageUserCollection.insertOne(user);
      res.send(result);
    });

    // Get specifiq user by email to view profile
    app.get("/users/viewBiodata/:email", async (req, res) => {
      const email = req.params.email;
      const result = await manageUserCollection.findOne({ email: email });
      res.send(result);
      });

    // Update User profile 
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedBiodata = req.body;
      const newUpdatedBiodata = {
          $set: {
            Biodata: updatedBiodata.Biodata,
            BiodataNumber: updatedBiodata.BiodataNumber,
            Name: updatedBiodata.Name,
            ProfileImage: updatedBiodata.ProfileImage,
            DateOfBirth: updatedBiodata.DateOfBirth,
            Height: updatedBiodata.Height,
            Weight: updatedBiodata.Weight,
            Age: updatedBiodata.Age,
            Occupation: updatedBiodata.Occupation,
            Race: updatedBiodata.Race,
            FathersName: updatedBiodata.FathersName,
            MothersName: updatedBiodata.MothersName,
            PermanentDivisionName: updatedBiodata.PermanentDivisionName,
            PresentDivisionName: updatedBiodata.PresentDivisionName,
            ExpectedPartnerAge: updatedBiodata.ExpectedPartnerAge,
            ExpectedPartnerHeight: updatedBiodata.ExpectedPartnerHeight,
            ExpectedPartnerWeight: updatedBiodata.ExpectedPartnerWeight,
            ContactEmail: updatedBiodata.ContactEmail,
            MobileNumber: updatedBiodata.MobileNumber,
            MembershipType: updatedBiodata.MembershipType,
              
          }
      }
      const result = await manageUserCollection.updateOne(filter, newUpdatedBiodata, options)
      res.send(result)
  })

    //Admin email get 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;  // Corrected from req.params.ContactEmail
      console.log(req.decoded.ContactEmail)
      if (email !== req.decoded.ContactEmail) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await manageUserCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })


    // Make admin a User
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await manageUserCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    // Make  User Premium
    app.patch('/users/premium/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          MembershipType: "Premium"
        }
      }
      const result = await manageUserCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // GET sorted Featured biodata for homepage
    app.get('/featuredBiodata', async (req, res) => {
      const cursor = biodataCollection.find({ MembershipType: 'Premium' }).sort({ Age: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get specifiq data by id for details page
    app.get("/details/:id", async (req, res) => {
      const id = req.params.id;
      const result = await biodataCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });



    // Favourite Ralated api
    app.get('/favourites', async (req, res) => {
      try {
        const userEmail = req.query.userEmail;
        const query = { userEmail: userEmail };
        console.log(query);
        const result = await favouriteCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error retrieving favorites:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // Add to favourite
    app.post('/favourites', async (req, res) => {
      const favouriteItem = req.body;
      const result = await favouriteCollection.insertOne(favouriteItem);
      res.send(result)
    })
    // Delete from favourite
    app.delete("/favourites/:id", async (req, res) => {
      const id = req.params.id;
      const result = await favouriteCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Requests related api
    app.get('/requests', async (req, res) => {
      try {
        const userEmail = req.query.userEmail;
        const query = { userEmail: userEmail };
        console.log(query);
        const result = await requestCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error retrieving favorites:', error);
        res.status(500).send('Internal Server Error');
      }
    });
    // Add to requests
    app.post('/requests', async (req, res) => {
      const requestedItem = req.body;
      const result = await requestCollection.insertOne(requestedItem);
      res.send(result)
    })
    // Delete from requests
    app.delete("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const result = await requestCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });


    // Ratings related api
    app.get("/ratings", async (req, res) => {
      const result = await ratingsCollection.find().toArray();
      res.send(result);
    });
    // Subbmit ratings
    app.post("/ratings", async (req, res) => {
      const service = req.body;
      const result = await ratingsCollection.insertOne(service);
      res.send(result);
      });

    


    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('blissfulMatch Server is Running')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})