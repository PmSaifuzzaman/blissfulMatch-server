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

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // Biodata related api
    // Get all biodatas
    app.get("/biodatas", async (req, res) => {
      const result = await biodataCollection.find().toArray();
      res.send(result);
    });

    // User related api
    app.post('/biodatas', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists: 
      const query = { ContactEmail: user.ContactEmail }
      const existingUser = await biodataCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await biodataCollection.insertOne(user);
      res.send(result);
    });

    // Make admin a User
    app.patch('/biodatas/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await biodataCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // app.get("/biodatas", async (req, res) => {
    //   const { biodataType } = req.query;

    //   let filter = {};
    //   if (biodataType) {
    //     filter = { Biodata: biodataType };
    //   }

    //   try {
    //     const result = await biodataCollection.find(filter).toArray();
    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching data:", error);
    //     res.status(500).send("Internal Server Error");
    //   }
    // });


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