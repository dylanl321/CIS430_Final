jQuery(document).ready(function () {
    Date.prototype.format = function () {
        return this.getFullYear() + '-' + this.strPad(this.getMonth() + 1) + '-' + this.strPad(this.getDate());
    };

    Date.prototype.strPad = function (val) {
        if (val > 9) {
            return val.toString();
        }
        return '0' + val;
    };

    var Scheduler = function (options) {
        this.init(options);
    }
    jQuery.extend(Scheduler.prototype, {
    	options: {
            'api_url': 'https://user-api.simplybook.me',
            'api_login': 'teamlinq',
            'api_key': '4965a4cbd55b760bd70f3ff86c08d499078209499c6d2c1d0383e2ca403c7018'
        },
    	/*options: {
            'api_url': '//user-api.em.dimka.notando.com.ua',
            'api_login': 'recap',
            'api_key': '8f5259e8e9f6d9342d40ef523b2f1fe52c0a3b543d140b5a3da906f17ab30e11'
        },*/
        client: null,
        anyUnitData: null,

        events: {},
        units: {},
        attachedUnits: [],

        eventId: null,
        unitId: null,
        qty: 1,
        selectedUnitId: null,
        date: null,
        time: null,

        weekends: {},

        groupBookingsAllowed: false,
        multipleBookingsAllowed: false,

        batchId: null,

        additionalFields: [],

        init: function (options) {
            this.options = jQuery.extend({}, this.options, options);
            this.initClient();
            this.initElements();
            this.initEvents();
        },

        initClient: function () {
        	var instance = this;

        	var loginClient = new JSONRpcClient({
                'url': this.getParam('api_url') + '/login',
                'onerror': function (error) {
                	instance.error(error);
                }
            });
        	var token = loginClient.getToken(this.getParam('api_login'), this.getParam('api_key'));
            this.client = new JSONRpcClient({
                'url': this.getParam('api_url'),
                'headers': {
                    'X-Company-Login': this.getParam('api_login'),
                    'X-Token': token
                },
                'onerror': function (error) {
                	instance.error(error);
                }
            });
            this.groupBookingsAllowed = this.client.isPluginActivated('group_booking');
            this.multipleBookingsAllowed = this.client.isPluginActivated('multiple_booking');
        },

        initElements: function () {
        	jQuery('#qty-element').hide();

            var instance = this;
        	jQuery('#date').datepicker({
                'startDate': new Date(),
                'todayHighlight': true,
                'format': 'yyyy-mm-dd',
                'beforeShowDay': function (date) {
        		    if (instance.weekends[date.format()] == true) {
        		        return {'enabled': false};
        		    }
        		}
            });
            this.client.getEventList(function (events) {
                instance.events = events;
                for (var id in events) {
                    var event = events[id];
                    jQuery('#event_id').append(
                        jQuery('<option value="' + event.id + '">' + event.name + '</option>')
                    );
                    if (event.unit_map) {
                        for (var unitId in event.unit_map) {
                            instance.attachedUnits.push(unitId);
                        }
                    }
                }
            });
            this.client.getAnyUnitData(function (data) {
            	instance.anyUnitData = data;
            	instance.client.getUnitList(function (units) {
                	instance.units = units;
                    instance.setUnitList(units);
                });
            });
            this.client.getFirstWorkingDay(null, function (date) {
                instance.updateWorkCalendar(new Date(Date.parse(date)), function () {
                	jQuery('#date').datepicker('update', date);
                });
            });
            if (!this.multipleBookingsAllowed) {
            	jQuery('#add_booking').hide();
            }
            jQuery('#confirm_batch').hide();
        },

        initEvents: function () {
            var instance = this;
            jQuery('#event_id').change(function (event, value) {
                instance.setEventId(jQuery(this).val());
            });
            jQuery('#unit_id').change(function () {
                instance.setUnitId(jQuery(this).val());
            });
            jQuery('#qty').change(function () {
            	instance.setQty(jQuery(this).val());
            });
            jQuery('#date').on('changeDate', function (event) {
            	if (event.date) {
            		instance.setDate(event.date.format());
            	}
            }).on('changeMonth', function (event) {
            	instance.updateWorkCalendar(event.date);
            });
            jQuery('.time-handler').change(function () {
            	instance.loadStartTimeMatrix();
            });

            jQuery(document).on('click', '.time-item', function () {
                jQuery('.time-item.active').removeClass('active');
                jQuery(this).addClass('active');
                debugger;
                jQuery('.sTime').empty();
                jQuery('#selectedTime').append(
                  jQuery('<div class="item-title sTime">'+ tConvert(jQuery(this).data('time')) + '</div>')
                );
                jQuery('#noTimes').hide();
                mainView.router.back();
                instance.setTime(jQuery(this).data('time'));
                if (instance.unitId == -1) {
                	var unitArr = instance.client.getAvailableUnits(instance.eventId, instance.date + ' ' + instance.time, instance.qty);
                	if (unitArr.length) {
                		instance.selectedUnitId = unitArr[0];
                	}
                }
            });
            //debugger;
            jQuery('#book').click(function () {
            	if (instance.selectedUnitId) {
            		jQuery('#unit_id').val(instance.selectedUnitId);
                //navigator.vibrate(500);
                //myApp.addNotification({title: 'ERROR',
                //message: 'You are missing one or more fields'});

            	}
                instance.showClientInfo();
                //navigator.vibrate(500);

            });
            jQuery('#confirm').click(function () {
                myApp.showPreloader('Booking');
                instance.bookAppointment();
            });
            jQuery('#confirm_batch').click(function () {
                instance.confirmBatch();
            });
            jQuery('#add_booking').click(function () {
            	instance.addAppointment(true);
            });
            jQuery('#cancel').click(function () {
                instance.cancel();
            });
        },

        setQty: function (qty) {
        	this.qty = qty;

        	if (qty > 1) {
        		jQuery('#add_booking').hide();
        	} else {
        		jQuery('#add_booking').show();
        	}
        },

        setUnitList: function (units) {
            var oldVal = jQuery('#unit_id').val();


            jQuery('#unit_id option[value]').remove();
            if (this.anyUnitData) {
            	jQuery('#unit_id').append(
            		// -1 means any unit only for JS. We don't send it to server.
                    jQuery('<option value="-1">' + this.anyUnitData.name + '</option>')
                );
            }
            for (var id in units) {
                var unit = units[id];
                jQuery('#unit_id').append(
                    jQuery('<option value="' + unit.id + '">' + unit.name + '</option>')
                );

            }
            if (units[oldVal]) {
            	jQuery('#unit_id').val(oldVal);
            } else {
                this.setUnitId('');
            }
        },

        setEventId: function (id) {
            this.eventId = id;
            var event = this.events[id];
            var list = {};

            if (event.unit_map) {
                for (var unitId in event.unit_map) {
                    list[unitId] = this.units[unitId];
                }
            } else {
                for (var unitId in this.units) {
                    if (jQuery.inArray(unitId, this.attachedUnits) == -1) {
                        list[unitId] = this.units[unitId];
                    }
                }
            }

            this.setUnitList(list);

            if (this.groupBookingsAllowed && !this.batchId) {
	            var max = 1;
	            for (var unitId in list) {
	            	if (list[unitId] && list[unitId].qty > max) {
	            		max = list[unitId].qty;
	            	}
	            }

	            this.setMaxQty(max);
            } else {
            	jQuery('#qty-element').hide();
            }

            this.loadAdditionalFields(id);
        },

        setMaxQty: function (max) {
        	jQuery('#qty').empty();
        	this.qty = 1;
        	for (var i = 1; i <= max; i++) {
        		jQuery('#qty').append('<option value="' + i + '">' + i + '</option>');
        	}
        	if (max > 1) {
        		jQuery('#qty-element').show();
        	} else {
        		jQuery('#qty-element').hide();
        	}
        },

        setUnitId: function (id) {
            var instance = this;
            this.unitId = id;
            if (id && !this.date) {
            	if (id == -1) {
            		id = null;
            	}
              debugger;
               jQuery('.sTime').remove();
               jQuery('#noTimes').show();
              // jQuery('#selectedTime').append(
              //   jQuery('<div id="noTimes" class="item-title">Select Times</div>')
              // );
              jQuery('#date').datepicker('setDate', null);


                this.client.getFirstWorkingDay(id, function (date) {
                    instance.updateWorkCalendar(new Date(Date.parse(date)), function () {
                        instance.setDate(date);
                    });
                });
            }
        },

        updateWorkCalendar: function (date, callback) {
            if (!date) {
                date = jQuery('#date').datepicker('getDate');
            }
            var instance = this;
            var params = {
            	'unit_group_id': this.unitId,
            	'event_id': this.eventId
            };
            this.client.getWorkCalendar(date.getFullYear(), (date.getMonth() + 1), params, function (data) {
            	instance.weekends = {};
                for (var dt in data) {
                    if (data[dt].is_day_off == '1') {
                    	instance.weekends[dt] = true;
                    }
                }
                jQuery('#date').datepicker('update');
                if (jQuery.type(callback) == 'function') {
                    callback();
                }
            });
        },

        loadAdditionalFields: function (eventId) {
        	var instance = this;
        	this.client.getAdditionalFields(eventId, function (data) {
        		instance.clearAdditionalFields();
        		instance.additionalFields = data;
        		for (var i = 0; i < data.length; i++) {
        			instance.addAdditionalField(data[i]);
        		}
        	});
        },

        clearAdditionalFields: function () {
        	jQuery('#additional-fields').empty();
        	this.additionalFields = [];
        },

        addAdditionalField: function (field) {
        	var container = jQuery('<div class="item-inner"></div>');
        	var title = jQuery('<div class="item-title label">' + field.title + '</div>');

        	container.append(title);

        	var fieldContainer = jQuery('<div class="item-input"></div>');

        	container.append(fieldContainer);

        	var fieldNode = null;
        	switch (field.type) {
        		case 'checkbox':
        			fieldNode = jQuery('<input type="checkbox" name="' + field.name + '" id="' + field.name + '" value="1" />');
        			if (field['default']) {
        				fieldNode.attr('checked', true);
        			}
        			break;
        		case 'select':
        			fieldNode = jQuery('<select name="' + field.name + '" id="' + field.name + '"></select>');
        			var values = field.values.split(',');
        			for (var k = 0; k < values.length; k++) {
        				fieldNode.append(jQuery('<option value="' + values[k].trim() + '">' + values[k].trim() + '</option>'));
        			}
        			if (field['default']) {
        				fieldNode.val(field['default']);
        			}
        			break;
        		case 'textarea':
        			fieldNode = jQuery('<textarea name="' + field.name + '" id="' + field.name + '"></textarea>');
        			if (field['default']) {
        				fieldNode.val(field['default']);
        			}
        			break;
        		default:
        			fieldNode = jQuery('<input type="text" name="' + field.name + '" id="' + field.name + '" placeholder="' + field.title + '"/>');
	    			if (field['default']) {
	    				fieldNode.val(field['default']);
	    			}
        			break;
        	}

        	if (fieldNode) {
        		if (field.type == 'checkbox') {
        			fieldNode.addClass('checkbox');
        		} else {
        			fieldNode.addClass('form-control');
        		}

        		fieldContainer.append(fieldNode);
        		jQuery('#additional-fields').append(container);
        	}
        },

        setDate: function (date) {
            this.date = date;

            jQuery('#date').datepicker('update', date);
            this.loadStartTimeMatrix();
        },

        setTime: function (time) {
            this.time = time;
        },

        showClientInfo: function () {
            var instance = this;
            var unitId = this.unitId;
            if (unitId == -1) {
            	unitId = null;
            }

        	this.client.calculateEndTime(this.date + ' ' + this.time, this.eventId, this.unitId, function (res) {
        		jQuery('.has-error').removeClass('has-error');
        	    if (!res) {
        	    	jQuery('#time').parent().addClass('has-error');
        	    }
        	    if (!instance.eventId) {
                    jQuery('#event_id').parent().addClass('has-error');

                }
                if (!instance.unitId) {
                    jQuery('#unit_id').parent().addClass('has-error');
                }
                if (!instance.date) {
                    jQuery('#date').parent().addClass('has-error');

                }
                if (!instance.time) {
                    jQuery('#time').parent().addClass('has-error');

                }
                if (!jQuery('.has-error').length) {
                    jQuery('#schedule').hide();
                    jQuery('#client').show();
                    mainView.router.load({pageName: 'student'});
                    jQuery('#event_name').text(instance.events[jQuery('#event_id').val()].name);
                    jQuery('#unit_name').text(instance.units[jQuery('#unit_id').val()].name);
                    jQuery('#date_start').text(instance.date + ' ' + tConvert( instance.time));
                    jQuery('#date_end').text(res);
                }
                if(jQuery('.has-error').length) {
                  navigator.vibrate(500);

                    myApp.alert('There are missing fields!', 'Error');

                }

        	});
          // myApp.confirm('Would you like to add this to your calendar?', 'Successfully Booked',
          //   function () {
          //     //debugger;
          //     //alert("OK");
          //
          //
          //
          //     //Continue creating calendar.
          //
          //     var title = 'Office Hours With:' + instance.units[jQuery('#unit_id').val()].name;
          //     var loc = instance.events[jQuery('#event_id').val()].name;
          //     var notes = 'This is an Event Created with ASU BOOK ME. This is the time for meeting your professor for office hours!';
          //     var initialDate = instance.date + ' ' + instance.time;
          //     var startDate = new Date(initialDate.replace(/-/g,"/"));
          //     var endDate = new Date(startDate);
          //     //Add 15 min for the appointment
          //     endDate.setMinutes(endDate.getMinutes() + 15);
          //     var calendarName = 'BookME Calendar';
          //     var options = {
          //       url: 'http://bookme.com',
          //       calendarName: calendarName, // iOS specific
          //       calendarId: 1 // Android specific
          //     };
          //     debugger;
          //
          //     //We need to create a calendar in the users app before continueing
          //     createCalendar();
          //
          //     //Now that the calendar is created we can continue
          //     window.plugins.calendar.createEventInteractivelyWithOptions(title, loc, notes, startDate, endDate, options, onSuccess, onError);
          //   },
          //   function () {
          //
          //   }
          // );
        },

        bookAppointment: function () {
          //debugger;
          //myApp.showPreloader('Booking');
          var instance = this;
          var unitId = this.unitId;
        	if (this.validateClientData()) {
            	var unitId = this.unitId;
            	if (unitId == -1) {
            		unitId = this.selectedUnitId;
            	}
            	if (!this.qty || this.qty < 1) {
            		this.qty = 1;
            	}
            	var res = this.client.book(
            		this.eventId, unitId, this.date, this.time,
            		{'name': jQuery('#name').val(), 'email': jQuery('#email').val(), 'phone': jQuery('#phone').val()},
            		this.getAdditionalFieldsValues(), this.qty
            	);
              //debugger;
            	if (res.bookings) {

                myApp.hidePreloader();
                navigator.vibrate(500);
                myApp.confirm('Would you like to add this to your calendar?', 'Successfully Booked',
                  function () {
                    //debugger;
                    //alert("OK");



                    //Continue creating calendar.

                    var title = 'Office Hours With:' + instance.units[jQuery('#unit_id').val()].name;
                    var loc = instance.events[jQuery('#event_id').val()].name;
                    var notes = 'This a A Event Created with ASU BOOK ME. This is the time for meeting your professor for office hours!';
                    var initialDate = instance.date + ' ' + instance.time;
                    var startDate = new Date(initialDate.replace(/-/g,"/"));
                    var endDate = new Date(startDate);
                    //Add 15 min for the appointment
                    endDate.setMinutes(endDate.getMinutes() + 15);
                    var calendarName = 'BookME Calendar';
                    var options = {
                      url: 'http://bookme.com',
                      calendarName: calendarName, // iOS specific
                      calendarId: 1 // Android specific
                    };
                    //debugger;

                    //We need to create a calendar in the users app before continueing
                    createCalendar();

                    //Now that the calendar is created we can continue
                    window.plugins.calendar.createEventInteractivelyWithOptions(title, loc, notes, startDate, endDate, options, onSuccess, onError);
                    location.reload();

                  },
                  function () {

                  }
                );
            	}
            }

        },

        addAppointment: function (toFirstStep) {
            if (this.validateClientData()) {
            	if (!this.batchId) {
            		this.batchId = this.client.createBatch();
            	}

            	var unitId = this.unitId;
            	if (unitId == -1) {
            		unitId = this.selectedUnitId;
            	}
            	if (!this.qty || this.qty < 1) {
            		this.qty = 1;
            	}
            	var res = this.client.book(
            		this.eventId, unitId, this.date, this.time,
            		{'name': jQuery('#name').val(), 'email': jQuery('#email').val(), 'phone': jQuery('#phone').val()},
            		this.getAdditionalFieldsValues(), 1, this.batchId
            	);

            	jQuery('#confirm').hide();
            	jQuery('#confirm_batch').show();

            	if (toFirstStep) {
            		jQuery('#schedule').show();
                	jQuery('#client').hide();
            	}

            	return res;
            }
        },

        confirmBatch: function () {
        	var res = this.addAppointment();


        	alert('Your bookings were successfully booked.');

        	location.href = 'confirm_batch.php?batch_id=' + this.batchId + '&batch_type=' + res.batch_type + '&batch_hash=' + res.batch_hash;
        },

        getAdditionalFieldsValues: function () {
        	var result = {};
        	for (var i = 0; i < this.additionalFields.length; i++) {
        		var field = this.additionalFields[i];
        		value = null;
        		if (field.type == 'checkbox') {
        			if (jQuery('#' + field.name).is(':checked')) {
        				value = 1;
        			} else {
        				value = 0;
        			}
        		} else {
        			value = jQuery('#' + field.name).val();
        		}
        		result[field.name] = value;
        	}

        	return result;
        },

        validateClientData: function () {
        	jQuery('.has-error').removeClass('has-error');
            if (!jQuery('#name').val()) {
            	jQuery('#name').parent().addClass('has-error');
            }
            if (!jQuery('#email').val()) {
            	jQuery('#email').parent().addClass('has-error');
            }
            if (!jQuery('#phone').val()) {
            	jQuery('#phone').parent().addClass('has-error');
            }
            if (!jQuery('.has-error').length) {
            	return true;
            }
            myApp.hidePreloader();
            navigator.vibrate(500);

            myApp.alert('There are missing fields!', 'Error');

            return false;
        },

        cancel: function () {
          mainView.router.back();
        },


        loadStartTimeMatrix: function () {
            var instance = this;
            //debugger;
            if (this.unitId && this.eventId && this.date) {
              //debugger;
            	jQuery('#time').empty();
            	this.setTime(null);
            	var unitId = this.unitId;
            	if (unitId == -1) {
            		unitId = null;
            	}

                this.client.getStartTimeMatrix(this.date, this.date, this.eventId, unitId, this.qty, function (data) {
                    var times = data[instance.date];
                    //debugger;
                    jQuery('.sTime').remove();
                    jQuery('#noTimes').show();

                    if (times) {
                    	jQuery('#busy').hide();
                        for (var i = 0; i < times.length; i++) {

                            jQuery('#time').append(' <li class="item-content">\
                                      <div class="item-inner time-item" data-time="' + times[i] + '">\
                                        <div class="item-title">'+  tConvert(times[i]) +'\
                                      </div>\
                                    </li>\
                                    ');
                        }
                    } else {
                    	jQuery('#busy').show();
                    }
                });
            }
        },


        getParam: function (param, defaultValue) {
            if (jQuery.type(this.options[param]) != 'undefined') {
                return this.options[param];
            }
            return defaultValue;
        },

        error: function (error) {
          navigator.vibrate(500);

            myApp.alert(error);
        }

    });


    var scheduler = new Scheduler();




});
