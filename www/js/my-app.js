// Initialize app
var myApp = new Framework7();


// If we need to use custom DOM library, let's save it to $$ variable:
var $$ = Dom7;

// Add view
var mainView = myApp.addView('.view-main', {
    // Because we want to use dynamic navbar, we need to enable it for this view:
    dynamicNavbar: true,
    domCache: true
});

// Handle Cordova Device Ready Event
$$(document).on('deviceready', function() {
    console.log("Device is ready!");
});


// Now we need to run the code that will be executed only for About page.

// Option 1. Using page callback for page (for "about" page in this case) (recommended way):
/*myApp.onPageInit('about', function (page) {
    // Do something here for "about" page

})

// Option 2. Using one 'pageInit' event handler for all pages:
$$(document).on('pageInit', function (e) {
    // Get page data from event data
    var page = e.detail.page;

    if (page.name === 'about') {
        // Following code will be executed for page with data-page attribute equal to "about"
        myApp.alert('Here comes About page');
    }
})

// Option 2. Using live 'pageInit' event handlers for each page
$$(document).on('pageInit', '.page[data-page="about"]', function (e) {
    // Following code will be executed for page with data-page attribute equal to "about"
    myApp.alert('Here comes About page');
})*/

$$('.open-clientinfo').on('click', function () {
  myApp.popup('.popup-clientinfo');
});

$$('.open-times').on('click', function () {
  myApp.popup('.popup-times');
});
$$('#reset').on('click', function () {
  location.reload();
});




var today = new Date();
var weekLater = new Date().setDate(today.getDate() + 7);
var calendarDisabled = myApp.calendar({
    input: '#calendar-disabled',
    dateFormat: 'M dd yyyy',
    disabled:[new Date(2016, 12 , 1), new Date(2016, 12, 10)],
    events: [
        new Date(2016, 12, 1),
        new Date(2016, 12, 10),
        {
            from: new Date(2016, 12, 15),
            to: new Date(2016, 12, 20)
        },
        {
            from: new Date(2016, 12, 25),
            to: new Date(2016, 12, 30)
        }
    ],
});
