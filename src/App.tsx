import { useState } from 'react';
import { Route, Switch } from 'react-router-dom';
import Today from './pages/Today';
import Calendar from './pages/Calendar';
import Chores from './pages/Chores';
import Lists from './pages/Lists';

function App() {
  const [data, setData] = useState([]);

  return (
    <div className="App">
      <Switch>
        <Route path="/today" exact component={Today} />
        <Route path="/calendar" exact component={Calendar} />
        <Route path="/chores" exact component={Chores} />
        <Route path="/lists" exact component={Lists} />
      </Switch>
    </div>
  );
}

export default App;

