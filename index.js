const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1tebz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const app = express()

const port = process.env.PORT || 3000;

app.use(
    cors({
      origin: [
        "http://localhost:4001", 
        "https://surplus-reduction-community.web.app", 
        "https://surplus-reduction-community.firebaseapp.com"
        ], // Adjust origin for your frontend domain
      credentials: true,
    })
);
app.use(express.json())
app.use(cookieParser());

const verifyToken = (req, res, next) => {
    const token = req.cookies.token
    console.log('token',token)
    if(!token)
    {
      return res.status(401).send({message: 'unauthorized access(token nai)'})    //res.status(401).send({message: 'unauthorized access'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if(err)
      {
        return res.status(401).send({message: 'unauthorized access tor'})
      }
      req.user = decoded;
      next();
    })
}


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
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const AvailableFoodCollection = client.db('SurplusReductionCommunity').collection("availableFood")
    const RequestFoodCollection = client.db('SurplusReductionCommunity').collection("requestFood")

    app.post("/jwt", async (req, res) => {
        const existingToken = req.cookies.token; 
        if (existingToken) {
          try {
              const decoded = jwt.verify(existingToken, process.env.ACCESS_TOKEN_SECRET);
              return res.send({ token: existingToken });
          } catch (err) {
              console.log("Token expired or invalid, generating a new one.");
          }
        }
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ token }); // Ensure response is sent
      });
    
    app.post("/logOut", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    app.get('/availableFood', async(req,res) => {
        if(req.query.foodName)
        {
            const query = {foodName: {$regex: req.query.foodName, $options: "i"}}
            const result = await AvailableFoodCollection.find(query).toArray()
            return res.send(result)
        } else if (req.query.donatorEmail)
        {
            const query = {donatorEmail: req.query.donatorEmail}
            const result = await AvailableFoodCollection.find(query).toArray()
            return res.send(result)
        } else if(req.query.page)
        {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10;
          const skip = (page - 1) * limit;
          const cursor = AvailableFoodCollection.find().skip(skip).limit(limit)
          const result = await cursor.toArray()
          const totalItems = await AvailableFoodCollection.countDocuments()
          return res.send({
            data: result,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page
          })
        }
        const cursor = AvailableFoodCollection.find()
        const result = await cursor.toArray()
        res.send(result)
    })

    app.get('/availableFood/:id', async(req, res) => {
        const id = req.params.id
        const filter = {_id: new ObjectId(id)}
        const result = await AvailableFoodCollection.findOne(filter)
        res.send(result)
    })

    app.post('/availableFood', async(req, res) => {
        const food = req.body
        const result = await AvailableFoodCollection.insertOne(food)
        res.send(result)
    })
    
    app.put('/availableFood/:id', async(req, res) => {
        const id = req.params.id
        const food = req.body
        const filter = {_id: new ObjectId(id)}
        const options = {upsert: true}
        const update = {
            $set: {
                foodName: food.foodName,
                foodImage: food.foodImage,
                quantity: food.quantity,
                location: food.location,
                expDate: food.expDate,
                status: food.status,
                notes: food.notes,
                addedTime: food.addedTime
            }
        }
        const result = await AvailableFoodCollection.updateOne(filter, update, options);
        res.send(result)
    })
    app.delete('/availableFood/:id', async(req, res) => {
        const id = req.params.id
        const filter = {_id: new ObjectId(id)}
        const result = await AvailableFoodCollection.deleteOne(filter)
        res.send(result)
    })

    app.get('/requestFood',verifyToken, async(req,res) => {
        console.log('token owner info', req.user, req.query.requestUserEmail)
        if(req.user.email !== req.query.requestUserEmail)
        {
          return res.status(403).send({message: 'forbidden access'})
        }
        if(req.query.requestUserEmail)
        {
            const query = {requestUserEmail: req.query.requestUserEmail}
            const result = await RequestFoodCollection.find(query).toArray()
            return res.send(result)
        }
        const result = await RequestFoodCollection.find().toArray()
        res.send(result)
    })
    app.post('/requestFood', async(req,res) => {
        const request = req.body
        const result = RequestFoodCollection.insertOne(request)
        res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('running')
})
app.listen(port, () => {
    console.log(`running port : ${port}`)
})