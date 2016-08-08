import React from 'react';
import ReactDom from 'react-dom';
let jpath = require('jpath-query');
let jquery = require('jquery');

const image_count = 10;

class RetrainingIndicator extends React.Component {
  render() {
    return (<div className="loading.train--loading">
        <div className="loader-container">
          <svg className="loader" viewBox="25 25 50 50">
            <circle className="loader__path" cx='50' cy='50' r='20'/>
          </svg>
        </div>
      <p className="base--p loading--message"> Watson is training your new classifier. </p>
      <p className="base--p loading--message"> This might take up to 4-5 minutes based on number of images.</p>
        </div>);
  }
}

class FormTitleHOne extends React.Component {
  render() {
    return (<div className="retrain--header">
      <h2 className="title-bar base--h2">{this.props.name ? 'Retrain' : 'Hello'}
      <div className="status-bar">Classifier has status: {this.props.status}</div>
      </h2>

      <p>Improve the classiefier by uploading additional images or adding a new class.
      Paste an image URL</p>

      {this.props.status !== 'ready' ? <RetrainingIndicator/> : <div style={{display: 'none'}}></div>}
    </div>);
  }
}

class FormTitleBar extends React.Component {
  constructor() {
    super();
    this.state = {};
  }
  componentDidMount() {
    if (this.props.classifier_id) {
      this.retryRequest();
    }
  }

  componentWillUnmount() {
    if (this.serverRequest) {
      this.serverRequest.abort();
    }
  }
  retryRequest() {
    if (this.serverRequest && this.serverRequest.active) {
      this.serverRequest.abort();
    }

    this.serverRequest = jquery.get('/api/classifiers/' + this.props.classifier_id).done(function (results) {
      if (this.state.submitted || results.status === 'retraining' || results.status === 'training') {
        setTimeout(this.retryRequest.bind(this), 5000);
      }
      this.setState({classifierData: results, submitted: false});
    }.bind(this));
  }

  willSubmit() {
    this.setState({submitted: true});
  }

  didSubmit(newClassifierData) {
    if (this.props.classifier_id) {
      this.setState({submitted: true, classifierData: newClassifierData});
      setTimeout(this.retryRequest.bind(this),1000);
    }
  }
  render() {
    if (this.state.classifierData) {
      return (<div className="improve--form">
        <FormTitleHOne status={this.state.submitted ? 'submitted' : this.state.classifierData.status} name={this.state.classifierData.name}/>
        <UpdateForm status={this.state.submitted ? 'submitted' : this.state.classifierData.status} classifier_id={this.state.classifierData.classifier_id} classes={this.state.classifierData.classes} willSubmit={this.willSubmit.bind(this)} afterSubmit={this.didSubmit.bind(this)}/></div>);
    } else {
      return (<div className="improve--Form"></div>);
    }
  }
}
class TrainClassCell extends React.Component {
  constructor() {
    super();
    this.state = { nameValue: '' };
  }
  handleClick(e) {
    e.preventDefault();
    if (e.target.getAttribute('name') === 'classname') {
      return false;
    }
    let parent_id = 'top-'+this.props.name;
    var element = e.target;
    while ( element.getAttribute('id') !== parent_id) {
      element = element.parentElement;
    }
    element.firstElementChild.nextElementSibling.dispatchEvent(new Event('click'));
    return false;
  }
  changeAction(parentAction,e) {
    e.preventDefault();

    let validMimeType = {'application/zip': true}[jpath.jpath('/target/files/0/type',e)];
    if (jpath.jpath('/target/files/length', e, 0) > 0) {
      if (validMimeType) {
        parentAction(jpath.jpath('/target/files/0', e));

        if (this.props.kind === 'new') {
          let trimmed_name = jpath.jpath('/target/files/0/name', e).split('.')[0]
          this.setState({nameValue: trimmed_name, has_file: true});
        } else {
          this.setState({has_file: true});
        }
      }
    } else {
      parentAction(null);
      this.setState({has_file: false});
    }
  }
  textChange(e) {
    e.preventDefault();
    this.setState({nameValue: e.target.value});
  }

  inputStyle() {
    return {'new' : { width: '90%', fontSize: '1.5vw', textAlign: 'center' },
      'negative'  : { display: 'none' },
      'positive'  : { display: 'none' }
    }[this.props.kind];
  }
  displayName() {
    return {'new' : '',
      'negative'  : this.props.name,
      'positive'  : this.props.name
    }[this.props.kind];
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.classCount === 0) {
      this.setState({has_file: false, nameValue: ''});
    }
  }
  render() {
    return (
        <div id={"top-"+this.props.name} className="base-div" onClick={this.handleClick.bind(this)}>
          <div id={this.props.name}>
            <h3 className="base--h3">
              {this.displayName()}
              <input style={this.inputStyle()} type="text" name="classname" onChange={this.textChange.bind(this)} placeholder="New Class" value={this.state.nameValue || this.props.name}/>
            </h3>
            { this.state.has_file ? <img style={{maxWidth: '45%'}} className="text-zip-image" src="images/VR zip icon.svg"/> : <div><span className="text-label">Select</span>
            <div>or drag a zipped folder with at least {image_count} images</div></div>}
          </div>
          <input onChange={this.changeAction.bind(this,this.props.parentAction)} style={{display: 'none'}} type="file" name={this.props.name}/>
        </div>);
  }
}

class UpdateForm extends React.Component {
  constructor() {
    super();
    this.state = { classCount: 0 }
  }
  addFile(fileObj) {
    let newCount = fileObj ? this.state.classCount + 1 : this.state.classCount - 1;
    this.setState({classCount: newCount });
  }
  componentWillUnmount() {
    if (this.submitAction) {
      this.submitAction.abort();
    }
  }

  submit(e) {
    e.preventDefault();
    let q = new FormData(e.target);
    let filtered_form = q.getAll('classname').reduce(function(store, item) { let f = q.get(item) || q.get('New Class');
      if (f.size && !item.match(/Negative Class/)) {
        store.append(item+"_positive_examples",f);
      } else if (f.size && item.match(/Negative Class/)) {
        store.append('negative_examples',f);
      }
      return store;
    },new FormData());
    let beforeSubmitCallBack = this.props.willSubmit;
    let afterSubmitCallback = this.props.afterSubmit;
    beforeSubmitCallBack();
    e.target.reset();
    this.setState({classCount: 0, submitted: true});

    this.submitAction = jquery.ajax({ method: 'POST',
      url: '/api/retrain/' + this.props.classifier_id,
      data: filtered_form,
      contentType: false,
      dataType: 'json',
      processData: false
    }).done(function(data) {
      afterSubmitCallback ? afterSubmitCallback(data) : null;
      this.setState({submitted: false});
    }.bind(this)).fail(function(jxr, status,error) {
      afterSubmitCallback ? afterSubmitCallback({error: error}) : null;
      this.setState({submitted: false});
    }.bind(this));
  }

  render() {
    let form_style = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyItems: 'center'
    };

    let submit_button_style = {
      width: "100%",
      cursor: "pointer",
    };

    let submit_button_style_disabled = {
      width: "100%",
      cursor: "not-allowed",
      backgroundColor: '#959595',
      borderColor: '#959595'
    };

    let self = this;
    let classCount = this.state.classCount;
    let wasSubmitted = this.state.submitted || this.props.status !== 'ready';

    if (wasSubmitted) {
      return (<div style={{display: 'none'}}></div>);
    } else {

      return (<form style={form_style} onSubmit={this.submit.bind(this)}>

        <div className="existing">

          {this.props.classes.map(function (item) {
            return (<TrainClassCell key={item.class} classCount={classCount} kind='positive'
                                    parentAction={self.addFile.bind(self)} name={item.class}/>);
          })}
          <TrainClassCell classCount={classCount} key='newclass' kind='new' parentAction={this.addFile.bind(this)}
                          name="New Class"/>
        <TrainClassCell key="negative-class" kind='negative' classCount={classCount}
                        parentAction={this.addFile.bind(this)} name='Negative Class'/>
          </div>
        {this.state.classCount < 1 ? <div>Add At Least One Zip File</div> : <div style={{display: 'none'}}></div>}
        { this.state.classCount > 0 ?
            <input className="base--button" style={submit_button_style} type="submit"
                   value="Retrain your classifier"/> :
            <input className="base--button disabled" style={submit_button_style_disabled} disabled={true} type="submit"
                   value="Retrain your classifier"/>
        }
        <p>This is a demo. For full functionality, try out the API.</p>
      </form>);
    }
  }
}

export default FormTitleBar;

export function displayRetrainingForm(classifier_id, targetid) {
  let target = document.getElementById(targetid);
  if (target) {
    ReactDom.render(<FormTitleBar classifier_id={classifier_id}/>, target);
  }
}