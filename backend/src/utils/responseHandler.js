
// A utility function to standardize API responses

const response = (res, statusCode, message, data = null) => {
    if(!res){
        console.error("Response object is not provided");
        return;
    }
    const responseObject = { 
        status: statusCode < 400 ? "success" : "error",
        message,
        data
     }
     return res.status(statusCode).json(responseObject);
}
module.exports = response;
